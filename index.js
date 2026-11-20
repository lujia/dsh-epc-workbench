/**
 * EPC Project Workbench — host half.
 *
 * Two jobs:
 *
 *   1. Serve the project dataset the client renders.
 *   2. Turn a project folder the user picks in the interface into that dataset.
 *
 * Until a folder is picked the workbench serves the synthetic dataset that ships
 * with the package, so a fresh install shows a working page. Once the user picks
 * a folder, this half writes a config for it (tools/discover_folder.py), runs the
 * extractor (tools/build_data.py) into a cache directory outside the picked
 * folder, and serves those two files instead — the project folder is only ever
 * read.
 *
 * When the deterministic reader finds nothing it recognises — a folder laid out
 * some other way — the host asks the model the harness is already running to work
 * out what the folder holds (analyze.js) and extracts against that answer instead.
 *
 * Routes, all same-origin under /plugins/epc-workbench:
 *
 *   GET  /data                    the dataset the client renders
 *   GET  /index                   the search index that belongs to it
 *   GET  /state                   what is being served, and how the build is going
 *   POST /folder   {folder}        read that folder; answers as soon as it starts
 *   POST /analyze  {folder}        read it with the model even if the reader could
 *   POST /reset                   go back to the bundled dataset
 */
import { spawn } from 'node:child_process';
import { analyzeFolder, mergeConfigs, reanchor } from './analyze.js';
import { access, copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir, homedir } from 'node:os';

const name = 'dsh-epc-workbench';

/** Absolute package root — this file lives at <root>/index.js. */
const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, 'data');

const ROUTE_PREFIX = '/plugins/epc-workbench';
const ROUTE_DATA = `${ROUTE_PREFIX}/data`;
const ROUTE_INDEX = `${ROUTE_PREFIX}/index`;
const ROUTE_STATE = `${ROUTE_PREFIX}/state`;
const ROUTE_FOLDER = `${ROUTE_PREFIX}/folder`;
const ROUTE_ANALYZE = `${ROUTE_PREFIX}/analyze`;
const ROUTE_RESET = `${ROUTE_PREFIX}/reset`;
const ROUTE_MODELS = `${ROUTE_PREFIX}/models`;

export const inject = ['webServer'];

/** Where a built dataset is cached. Never inside the project the user picked. */
function cacheRoot() {
	const home = process.env.DSH_HOME || join(homedir(), '.dsh');
	return join(home, 'cache', 'epc-workbench');
}

/**
 * The python that has openpyxl. The harness ships one; a machine with its own
 * python on PATH is served by `python3`/`python` as a fallback, so the plugin
 * works whether or not the harness runtime is where it usually is.
 */
async function findPython() {
	const candidates = [];
	if (process.env.EPC_WORKBENCH_PYTHON) candidates.push(process.env.EPC_WORKBENCH_PYTHON);
	const home = process.env.DSH_HOME || join(homedir(), '.dsh');
	candidates.push(join(home, 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python', 'python.exe'));
	candidates.push(join(home, 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python', 'bin', 'python3'));
	candidates.push('python3', 'python');
	for (const candidate of candidates) {
		if (!candidate.includes('/') && !candidate.includes('\\')) return candidate;
		try {
			await access(candidate, fsConstants.X_OK);
			return candidate;
		} catch {
			/* try the next one */
		}
	}
	return 'python';
}

function json(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Content-Length': Buffer.byteLength(payload),
		'Cache-Control': 'no-store',
	});
	res.end(payload);
}

function safeMessage(error) {
	return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

/**
 * Accept only requests addressed to this listener. `/folder` changes what the
 * page shows, so the same check the read routes use also gates it.
 */
function hostIsLocal(req) {
	const host = req.headers.host;
	if (typeof host !== 'string' || host === '') return true;
	const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
	if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || hostname === '127.0.0.1') return true;
	if (/^127\./.test(hostname)) return true;
	return false;
}

async function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on('data', (chunk) => {
			size += chunk.length;
			if (size > 1 << 20) {
				reject(new Error('request body too large'));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		req.on('error', reject);
	});
}

/**
 * Which files are being served right now. `active` points at the bundled dataset
 * until a project build succeeds, so an error or a restart always leaves the
 * workbench with something to show.
 */
const active = {
	dir: DATA_DIR,
	source: 'bundled',
	folder: null,
	builtAt: null,
	notes: [],
	found: [],
	model: null,
	// Sections the picked folder did not provide, standing in from the demo.
	demo: [],
	// Sections the folder did not provide at all. A real read leaves these empty
	// rather than filling them from the demo, so the page can say what to add.
	blank: [],
};

const build = {
	status: 'idle',
	phase: 'idle',
	folder: null,
	startedAt: null,
	finishedAt: null,
	error: null,
	log: '',
	model: null,
};

/** Serialised builds: two people clicking twice must not write the same files. */
let building = null;

function datasetPaths(dir) {
	return { data: join(dir, 'workbench.json'), index: join(dir, 'index.json') };
}

async function exists(file) {
	try {
		await access(file, fsConstants.R_OK);
		return true;
	} catch {
		return false;
	}
}

async function stateFile() {
	return join(cacheRoot(), 'state.json');
}

async function saveState() {
	try {
		await mkdir(cacheRoot(), { recursive: true });
		await writeFile(
			await stateFile(),
			JSON.stringify({ dir: active.dir, source: active.source, folder: active.folder, builtAt: active.builtAt, notes: active.notes, found: active.found, model: active.model, demo: active.demo, blank: active.blank }, null, 1),
			'utf8',
		);
	} catch {
		/* a cache that cannot record itself is still usable in this session */
	}
}

async function restoreState() {
	try {
		const raw = JSON.parse(await readFile(await stateFile(), 'utf8'));
		if (!raw || typeof raw.dir !== 'string') return;
		const paths = datasetPaths(raw.dir);
		if ((await exists(paths.data)) && (await exists(paths.index))) {
			active.dir = raw.dir;
			active.source = raw.source === 'folder' ? 'folder' : 'bundled';
			active.folder = typeof raw.folder === 'string' ? raw.folder : null;
			active.builtAt = typeof raw.builtAt === 'string' ? raw.builtAt : null;
			active.notes = Array.isArray(raw.notes) ? raw.notes : [];
			active.found = Array.isArray(raw.found) ? raw.found : [];
			active.model = typeof raw.model === 'string' ? raw.model : null;
			active.demo = Array.isArray(raw.demo) ? raw.demo : [];
	active.blank = Array.isArray(raw.blank) ? raw.blank : [];
		}
	} catch {
		/* no previous build, or it was cleaned up: the bundled dataset is the default */
	}
}

/**
 * Read-once cache keyed by file path, invalidated when the extractor rewrites
 * the file. The dataset is rebuilt by a subprocess, so without the mtime check a
 * running host would keep serving the previous parse after a build finishes.
 */
const cache = new Map();

async function loadJson(file) {
	const info = await stat(file);
	const cached = cache.get(file);
	if (cached !== undefined && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
		return cached.data;
	}
	const data = JSON.parse(await readFile(file, 'utf8'));
	cache.set(file, { mtimeMs: info.mtimeMs, size: info.size, data });
	return data;
}

function serveFile(which) {
	return async (req, res) => {
		if (req.method !== 'GET' && req.method !== 'HEAD') {
			json(res, 405, { error: 'method not allowed' });
			return;
		}
		if (!hostIsLocal(req)) {
			json(res, 403, { error: 'host-not-trusted' });
			return;
		}
		const file = datasetPaths(active.dir)[which];
		try {
			const data = await loadJson(file);
			json(res, 200, data);
		} catch (error) {
			json(res, 503, {
				error: 'dataset-unavailable',
				message: `${safeMessage(error)} — run tools/build_data.py, or pick the project folder in the interface`,
			});
		}
	};
}

/** Run one child and return its exit code plus everything it printed. */
function run(argv, cwd) {
	return new Promise((resolve) => {
		let stdout = '';
		let stderr = '';
		let child;
		try {
			child = spawn(argv[0], argv.slice(1), {
				cwd,
				stdio: ['ignore', 'pipe', 'pipe'],
				env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
			});
		} catch (error) {
			resolve({ code: -1, stdout: '', stderr: safeMessage(error) });
			return;
		}
		child.stdout.on('data', (chunk) => {
			stdout += chunk.toString('utf8');
			if (stdout.length > 200000) stdout = stdout.slice(-100000);
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk.toString('utf8');
			if (stderr.length > 200000) stderr = stderr.slice(-100000);
		});
		child.on('error', (error) => resolve({ code: -1, stdout, stderr: `${stderr}${safeMessage(error)}` }));
		child.on('close', (code) => resolve({ code: code === null ? -1 : code, stdout, stderr }));
	});
}

/** The two JSON lines discovery prints, and the notes they carry. */
function parseDiscoveryNotes(stdout) {
	let notes = [];
	let found = [];
	const notesLine = stdout.split(/\r?\n/).find((line) => line.startsWith('NOTES '));
	const foundLine = stdout.split(/\r?\n/).find((line) => line.startsWith('FOUND '));
	if (notesLine) {
		try {
			notes = JSON.parse(notesLine.slice(6));
		} catch {
			notes = [];
		}
	}
	if (foundLine) {
		try {
			found = JSON.parse(foundLine.slice(6));
		} catch {
			found = [];
		}
	}
	return { notes, found };
}

/**
 * The extractor reports what it could not read on its last lines; those belong
 * beside the discovery notes so the page can name the empty sections. Discovery
 * and the extractor often say the same thing about the same record, so the labels
 * are stripped before comparing or the reader sees it twice.
 */
function mergeExtractorNotes(stdout, notes) {
	const seen = new Set(notes.map((n) => n.replace(/^reading the folder:\s*/i, '').trim()));
	for (const line of String(stdout || '').split(/\r?\n/)) {
		const hit = /^\s*-\s+(.*)$/.exec(line);
		if (!hit) continue;
		const text = hit[1].trim();
		const bare = text.replace(/^reading the folder:\s*/i, '').trim();
		if (!seen.has(bare)) {
			seen.add(bare);
			notes.push(text);
		}
	}
	return notes;
}

/** One extraction run against a config that has already been written. */
async function runExtractor(python, cfgPath, outDir) {
	build.phase = 'extracting';
	const result = await run([python, join(ROOT, 'tools', 'build_data.py'), cfgPath], ROOT);
	build.log += result.stdout + result.stderr;
	return { result, built: join(outDir, 'data') };
}

/**
 * Did the extraction actually produce a page?
 *
 * A folder holding nothing the reader recognises still extracts cleanly — it just
 * writes a dataset whose every section is empty, which is the page the user was
 * looking at when they reported this as a failure. Counting the sections is what
 * separates 'this project has no defects' from 'this folder is not the corpus'.
 */
async function datasetIsEmpty(dir) {
	try {
		const data = await loadJson(datasetPaths(dir).data);
		const letters = (data.letters && data.letters.total) || 0;
		const meetings = (data.meetings && data.meetings.total) || 0;
		const defects = (data.defects && data.defects.total) || 0;
		const ipcs = (data.payments && Array.isArray(data.payments.ipcs) && data.payments.ipcs.length) || 0;
		const main = data.mainContract ? 1 : 0;
		const retention = Object.keys(data.retention || {}).length;
		return letters + meetings + defects + ipcs + main + retention === 0;
	} catch {
		return true;
	}
}

/**
 * Stand the bundled demo in for whatever the folder did not provide.
 *
 * A folder that yields eleven letters and no defect register is not a failure, and
 * it is not a project without defects either. Serving it as-is prints empty cards
 * that read as zeros; refusing it leaves the reader with nothing after waiting for
 * a build. `tools/merge_dataset.py` takes each section from the folder when the
 * folder filled it and from the demo when it did not, and records which — so the
 * strip can say which parts of the page are standing in.
 */
async function mergeWithDemo(python, dataDir, blank = false) {
	const demo = datasetPaths(DATA_DIR);
	const folder = datasetPaths(dataDir);
	if (!(await exists(folder.data))) {
		// Nothing was written at all: a folder the reader could not describe and the
		// model could not interpret. The merge still needs a dataset to stand on, and
		// an empty one is the honest input — every section then comes from the demo.
		await mkdir(dataDir, { recursive: true });
		await writeFile(
			folder.data,
			JSON.stringify({ generated: new Date().toISOString(), project: {}, currencies: [], contracts: [], letters: {}, meetings: {}, defects: {}, payments: {}, retention: {}, certificate: {}, mainContract: null, docs: {}, defectRows: [], warnings: [] }),
			'utf8',
		);
		if (!(await exists(folder.index))) await writeFile(folder.index, '[]', 'utf8');
	}
	// A real read fills only what the folder established: a section the folder does
	// not carry stays blank and is re-read when the records arrive. The demo stands
	// in only for the first run and for 'Use demo data', where the page is meant to
	// be an example rather than a report.
	const argv = [python, join(ROOT, 'tools', 'merge_dataset.py'), folder.data, demo.data, dataDir];
	if (blank) argv.push('--blank');
	const result = await run(argv, ROOT);
	build.log += result.stdout + result.stderr;
	if (result.code !== 0) return { demo: [], blank: [] };
	const list = (label) => {
		const line = new RegExp('^' + label + ' sections: (.*)$', 'm').exec(result.stdout || '');
		const text = line ? line[1].trim() : '';
		if (!text || text === 'none') return [];
		return text.split(',').map((s) => s.trim()).filter(Boolean);
	};
	return { demo: list('demo'), blank: list('blank') };
}

/**
 * The models a reader can run the extraction on.
 *
 * The host owns the model catalogue, so the page cannot ask for it directly: the
 * client has no `llm` service. This lists what the installation actually has, with
 * the selection the session is using so the picker can default to it.
 */
async function listModels(ctx) {
	const llm = ctx.get('llm');
	if (!llm || typeof llm.listProviders !== 'function') return { providers: [], current: null };
	let providers = [];
	try {
		providers = await llm.listProviders();
	} catch (error) {
		build.log += 'the model catalogue could not be read: ' + safeMessage(error) + '\n';
		return { providers: [], current: null };
	}
	const out = [];
	for (const provider of providers || []) {
		const id = provider && (provider.id || provider.provider);
		if (!id) continue;
		let models = [];
		try {
			models = await llm.listModels(id);
		} catch {
			models = [];
		}
		out.push({
			id,
			name: (provider && (provider.name || provider.label)) || id,
			models: (models || []).map((m) => ({
				id: m.id,
				name: m.name || m.id,
				description: m.description || '',
				badge: m.badge || '',
			})),
		});
	}
	let current = null;
	try {
		const defaults = ctx.get('agentDefaultModel');
		if (defaults && typeof defaults.currentSelection === 'function') {
			const sel = defaults.currentSelection();
			if (sel && sel.provider && sel.model) current = { provider: sel.provider, model: sel.model };
		}
	} catch {
		current = null;
	}
	return { providers: out.filter((p) => p.models.length > 0), current };
}

async function handleModels(ctx, req, res) {
	if (req.method !== 'GET') return json(res, 405, { error: 'method-not-allowed' });
	if (!hostIsLocal(req)) return json(res, 403, { error: 'local-only' });
	const body = await listModels(ctx);
	return json(res, 200, body);
}

/**
 * The subject folders to read, one call each.
 *
 * A folder of records is organised however its author liked, so the list comes from
 * the folder itself — `tools/inventory.py --list` — and never from a fixed ten. The
 * question this answers is only 'which immediate subfolders exist'; whether any of
 * them is a contracts folder is the model's job, not this list's.
 */
async function listSubfolders(python, folder) {
	const result = await run([python, join(ROOT, 'tools', 'inventory.py'), folder, join(tmpdir(), 'unused.json'), '--list'], ROOT);
	if (result.code !== 0) return [];
	return result.stdout
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line !== '' && !line.startsWith('{'));
}

/**
 * Ask the model what this folder holds, and write the configuration it answers
 * with. Returns `{ config, model, notes }`: `config` is null when the model could
 * not describe the folder, and the caller then keeps whatever the deterministic
 * reader produced.
 *
 * `discoveredPath` is the configuration the deterministic reader already wrote.
 * When it exists the model's answer is merged INTO it rather than replacing it —
 * the reader parsed the workbooks, the model only saw a description of them.
 */
async function analyzeConfig(ctx, python, folder, cfgPath, outDir, discoveredPath = null, route = null) {
	// The folder is read one subject at a time. A project of any size holds more
	// records than one answer can carry — seven thousand letters, a thousand drawings
	// — and a model given all of it at once answers about the first thing it read.
	// One call per subfolder keeps each answer small enough to be checked, and the
	// answers are merged: a captioned project, a register, a series list, a price.
	const subjects = await listSubfolders(python, folder);
	const work = subjects.length > 0 ? subjects : [''];
	build.log += `reading ${work.length} subject folder(s) with the model\n`;

	const configs = [];
	const notes = [];
	let model = null;

	for (let index = 0; index < work.length; index += 1) {
		const subject = work[index];
		const label = subject || basename(folder);
		const target = subject ? join(folder, subject) : folder;
		build.phase = 'inventory';
		build.log += `\n[${index + 1}/${work.length}] ${label}\n`;
		const inventoryPath = join(outDir, 'inventory-' + (index + 1) + '.json');
		const read = await run([python, join(ROOT, 'tools', 'inventory.py'), target, inventoryPath], ROOT);
		if (read.code !== 0) {
			notes.push(`the folder ${label} could not be described for the model: ${(read.stderr || read.stdout).trim().slice(-200)}`);
			build.log += 'skipped: ' + (read.stderr || read.stdout).trim().slice(-200) + '\n';
			continue;
		}
		let inventory;
		try {
			inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
		} catch (error) {
			notes.push(`the description of ${label} could not be read: ${safeMessage(error)}`);
			continue;
		}
		// The call is told which folder it is reading, so an answer about the
		// drawings cannot quietly become an answer about the whole project.
		inventory.name = label;
		build.phase = 'model';
		build.log += `asking the model about ${label}\n`;
		const analysis = await analyzeFolder(ctx, folder, inventory, {
			route: route || undefined,
			subfolder: subject,
			index: index + 1,
			total: work.length,
		});
		if (analysis.model && !model) model = analysis.model;
		for (const note of analysis.notes || []) if (!notes.includes(note)) notes.push(note);
		if (analysis.config) {
			// The answer names paths as the model was shown them — relative to this
			// subfolder — while everything downstream resolves them against the root.
			configs.push(reanchor(analysis.config, subject, folder));
			build.log += `${label}: ${(analysis.config.contracts || []).length} contract(s), ${(analysis.config.letters || []).length} series\n`;
		} else {
			build.log += `${label}: no configuration\n`;
		}
	}

	const merged = mergeConfigs(configs);
	if (!merged) return { config: null, model, notes };
	notes.push(`the model read ${configs.length} of ${work.length} subject folder(s) and its answers were merged`);

	// The picked folder is the root and the cache is the output, whatever the model
	// said: an answer that names a path outside the folder still cannot read one.
	merged.sources = merged.sources || {};
	merged.sources.root = folder;
	merged.sources.out = join(outDir, 'data');
	merged._notes = notes.slice();

	const analysedPath = join(outDir, 'analysed.config.json');
	await writeFile(analysedPath, JSON.stringify(merged, null, 1), 'utf8');

	let finalPath = analysedPath;
	if (discoveredPath && (await exists(discoveredPath))) {
		// Merge, do not replace: see tools/merge_config.py. A model answer that
		// names the wrong workbook must not overwrite a sheet the reader opened.
		const mergedRun = await run(
			[python, join(ROOT, 'tools', 'merge_config.py'), discoveredPath, analysedPath, cfgPath],
			ROOT,
		);
		build.log += mergedRun.stdout + mergedRun.stderr;
		if (mergedRun.code === 0) {
			finalPath = cfgPath;
			const line = /^merged: (\d+) field/m.exec(mergedRun.stdout || '');
			merged.mergedFields = line ? Number(line[1]) : 0;
		}
	}
	if (finalPath !== cfgPath) await copyFile(finalPath, cfgPath);
	build.log += `the configuration was written by ${model}\n`;
	return { config: merged, model, notes, mergedFields: merged.mergedFields || 0 };
}

/** The python scripts that do the reading, and the folder they read. */
async function runBuild(ctx, folder, options = {}) {
	const python = await findPython();
	const outDir = join(cacheRoot(), createHash('sha1').update(folder).digest('hex').slice(0, 12));
	await mkdir(outDir, { recursive: true });
	const cfgPath = join(outDir, 'workbench.config.json');
	const force = options.mode === 'model';
	build.log = '';
	build.model = null;

	let notes = [];
	let found = [];
	let model = null;

	// Every way out of this function ends the same way: whatever the folder did
	// provide, with the demo standing in for the rest. Nothing here throws on a
	// folder that merely contains no records — the reported 'could not read that
	// folder' was that throw, and a folder of invoices is not a broken read.
	const finish = async (dir) => {
		// A real read leaves what the folder did not establish blank: the demo is the
		// first run's example, not a fallback for every folder someone picks.
		const merged = await mergeWithDemo(python, dir, true);
		return { dir, notes, found, model, demo: merged.demo, blank: merged.blank, partial: false };
	};

	// Both buttons start from the same place: what the files themselves say. The
	// difference is what happens next — 'Choose folder' stops when that reading is
	// usable, 'Analyze with model' always asks the model on top of it. Running
	// discovery first in the assisted path is what makes the two answers mergeable
	// instead of one replacing the other.
	build.phase = 'discovering';
	const discover = await run(
		[python, join(ROOT, 'tools', 'discover_folder.py'), folder, cfgPath, join(outDir, 'data')],
		ROOT,
	);
	build.log += discover.stdout + discover.stderr;
	const discoveredOk = discover.code === 0;
	if (!discoveredOk) {
		// Not fatal any more. A folder discovery could not describe still gets one
		// chance from the model, and if that fails too the page is the demo with a
		// note saying why, rather than a strip that says it could not read anything.
		notes.push(`the reader could not describe this folder: ${(discover.stderr || discover.stdout).trim().slice(-300)}`);
		build.log += 'the reader could not describe this folder, asking the model\n';
	}
	if (discoveredOk) {
		({ notes, found } = parseDiscoveryNotes(discover.stdout));
	}

	if (!force && discoveredOk) {
		const first = await runExtractor(python, cfgPath, outDir);
		if (first.result.code !== 0) {
			// A run that read most of the corpus and then tripped over one workbook is
			// a partial result, not a failed read: show whatever was written rather than
			// leaving the reader looking at the previous project.
			notes.push(`the reader stopped early: ${(first.result.stderr || first.result.stdout).trim().slice(-300)}`);
			const out = await finish(first.built);
			out.partial = true;
			return out;
		}
		mergeExtractorNotes(first.result.stdout, notes);
		// Two ways to know the reader did not understand this folder: it recognised
		// nothing at all (no note about any record it found), or it recognised
		// something and every section still came out empty. Either way the page the
		// user would see is the one they reported as a failure, so ask the model
		// before giving up on the folder.
		if (found.length > 0 && !(await datasetIsEmpty(first.built))) {
			return finish(first.built);
		}
		build.log += 'nothing here matched the reader, asking the model\n';
	}

	const analysis = await analyzeConfig(
		ctx, python, folder, cfgPath, outDir,
		discoveredOk ? cfgPath : null,
		options.route || null,
	);
	model = analysis.model;
	for (const note of analysis.notes || []) if (!notes.includes(note)) notes.push(note);
	if (!analysis.config) {
		if (!discoveredOk) {
			// Nothing was read and the model could not describe it: the demo stands in
			// for every section, and the notes say why. The reader gets a page and the
			// reason, instead of an error and no page.
			return finish(join(outDir, 'data'));
		}
		// The model had nothing to add but the reader's own answer still stands:
		// extract with what discovery wrote rather than failing the whole read.
		build.log += 'the model had nothing to add, using the reader\'s own answer\n';
	}

	const second = await runExtractor(python, cfgPath, outDir);
	if (second.result.code !== 0) {
		notes.push(`the reader stopped early: ${(second.result.stderr || second.result.stdout).trim().slice(-300)}`);
		const out = await finish(second.built);
		out.partial = true;
		return out;
	}
	mergeExtractorNotes(second.result.stdout, notes);
	if (analysis.config) {
		const added = analysis.mergedFields != null ? ` (${analysis.mergedFields} field(s) added)` : '';
		found.push(`the layout was described by ${model}${added}`);
	}
	return finish(second.built);
}

async function startBuild(ctx, folder, options = {}) {
	if (building !== null) return building;
	build.status = 'running';
	build.folder = folder;
	build.startedAt = new Date().toISOString();
	build.finishedAt = null;
	build.error = null;
	build.log = '';
	build.phase = options.mode === 'model' ? 'inventory' : 'discovering';
	building = (async () => {
		try {
			const result = await runBuild(ctx, folder, options);
			active.dir = result.dir;
			active.source = 'folder';
			active.folder = folder;
			active.builtAt = new Date().toISOString();
			active.notes = result.notes;
			active.found = result.found;
			active.model = result.model || null;
			active.demo = result.demo || [];
	active.blank = result.blank || [];
			// Drop every cached parse: the same path can be rebuilt with new numbers.
			cache.clear();
			build.status = 'ready';
			build.phase = 'done';
			build.model = result.model || null;
			build.log = build.log.slice(-4000);
			await saveState();
		} catch (error) {
			build.status = 'error';
			build.error = safeMessage(error);
		} finally {
			build.finishedAt = new Date().toISOString();
			building = null;
		}
	})();
	return building;
}

function handleState(req, res) {
	if (!hostIsLocal(req)) {
		json(res, 403, { error: 'host-not-trusted' });
		return;
	}
	json(res, 200, {
		active: {
			source: active.source,
			folder: active.folder,
			builtAt: active.builtAt,
			notes: active.notes,
			found: active.found,
			model: active.model,
			demo: active.demo,
		blank: active.blank,
		},
		build: {
			status: build.status,
			phase: build.phase,
			folder: build.folder,
			startedAt: build.startedAt,
			finishedAt: build.finishedAt,
			error: build.error,
			model: build.model,
			progress: build.log.slice(-1200),
		},
	});
}

async function handleFolder(ctx, req, res, forcedMode) {
	if (req.method !== 'POST') {
		json(res, 405, { error: 'method not allowed' });
		return;
	}
	if (!hostIsLocal(req)) {
		json(res, 403, { error: 'host-not-trusted' });
		return;
	}
	let body;
	try {
		body = JSON.parse((await readBody(req)) || '{}');
	} catch {
		json(res, 400, { error: 'bad-request', message: 'the body is not JSON' });
		return;
	}
	const folder = typeof body.folder === 'string' ? body.folder.trim() : '';
	if (folder === '') {
		json(res, 400, { error: 'bad-request', message: 'no folder was given' });
		return;
	}
	let info;
	try {
		info = await stat(folder);
	} catch {
		json(res, 400, { error: 'not-a-folder', message: `no such folder: ${folder}` });
		return;
	}
	if (!info.isDirectory()) {
		json(res, 400, { error: 'not-a-folder', message: `not a folder: ${folder}` });
		return;
	}
	if (build.status === 'running') {
		json(res, 409, { error: 'busy', message: 'a folder is already being read' });
		return;
	}
	// The answer is the start of the work, not its end: reading a real project
	// takes a minute or two, and the page polls /state for the result.
	const wantsModel = forcedMode === 'model' || body.mode === 'model';
	// The picker's choice, when it made one. It is passed through rather than
	// validated here: the llm service is the authority on which models exist, and a
	// stale id from an old page fails the same way an unlisted one does.
	const route = body.route && typeof body.route === 'object' && body.route.provider && body.route.model
		? { provider: String(body.route.provider), model: String(body.route.model) }
		: null;
	void startBuild(ctx, folder, { mode: wantsModel ? 'model' : 'reader', route });
	json(res, 202, { status: 'running', folder, mode: wantsModel ? 'model' : 'reader', route });
}

async function handleReset(req, res) {
	if (req.method !== 'POST') {
		json(res, 405, { error: 'method not allowed' });
		return;
	}
	if (!hostIsLocal(req)) {
		json(res, 403, { error: 'host-not-trusted' });
		return;
	}
	active.dir = DATA_DIR;
	active.source = 'bundled';
	active.folder = null;
	active.builtAt = null;
	active.notes = [];
	active.found = [];
	active.demo = [];
	active.blank = [];
	// The last build's outcome belongs to the folder that was just dropped; keeping
	// it would leave the page reporting a finished read of a project it no longer shows.
	build.status = 'idle';
	build.phase = 'idle';
	build.folder = null;
	build.startedAt = null;
	build.finishedAt = null;
	build.error = null;
	build.log = '';
	build.model = null;
	active.model = null;
	cache.clear();
	await saveState();
	json(res, 200, { status: 'ok', source: 'bundled' });
}

export function apply(ctx) {
	void restoreState();
	ctx.inject(['webServer'], (webCtx) => {
		webCtx.effect(() => {
			const disposers = [
				webCtx.webServer.register({ kind: 'exact', path: ROUTE_DATA, handler: serveFile('data') }),
				webCtx.webServer.register({ kind: 'exact', path: ROUTE_INDEX, handler: serveFile('index') }),
				webCtx.webServer.register({ kind: 'exact', path: ROUTE_STATE, handler: handleState }),
				webCtx.webServer.register({ kind: 'exact', path: ROUTE_MODELS, handler: (req, res) => handleModels(webCtx, req, res) }),
				webCtx.webServer.register({
					kind: 'exact',
					path: ROUTE_FOLDER,
					handler: (req, res) => {
						void handleFolder(ctx, req, res, 'reader');
					},
				}),
				webCtx.webServer.register({
					kind: 'exact',
					path: ROUTE_ANALYZE,
					handler: (req, res) => {
						void handleFolder(ctx, req, res, 'model');
					},
				}),
				webCtx.webServer.register({
					kind: 'exact',
					path: ROUTE_RESET,
					handler: (req, res) => {
						void handleReset(req, res);
					},
				}),
			];
			return () => {
				for (const dispose of disposers) dispose();
			};
		});
	});
}

export { name };
