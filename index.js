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
import { analyzeFolder } from './analyze.js';
import { access, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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
			JSON.stringify({ dir: active.dir, source: active.source, folder: active.folder, builtAt: active.builtAt, notes: active.notes, found: active.found, model: active.model }, null, 1),
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
 * Ask the model what this folder holds, and write the configuration it answers
 * with. Returns `{ config, model, notes }`: `config` is null when the model could
 * not describe the folder, and the caller then keeps whatever the deterministic
 * reader produced.
 *
 * `discoveredPath` is the configuration the deterministic reader already wrote.
 * When it exists the model's answer is merged INTO it rather than replacing it —
 * the reader parsed the workbooks, the model only saw a description of them.
 */
async function analyzeConfig(ctx, python, folder, cfgPath, outDir, discoveredPath = null) {
	build.phase = 'inventory';
	build.log += `describing ${folder} for the model\n`;
	const inventoryPath = join(outDir, 'inventory.json');
	const read = await run([python, join(ROOT, 'tools', 'inventory.py'), folder, inventoryPath], ROOT);
	build.log += read.stdout + read.stderr;
	if (read.code !== 0) {
		return {
			config: null,
			model: null,
			notes: [`the folder could not be described for the model: ${(read.stderr || read.stdout).trim().slice(-300)}`],
		};
	}
	let inventory;
	try {
		inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
	} catch (error) {
		return { config: null, model: null, notes: [`the folder description could not be read: ${safeMessage(error)}`] };
	}

	build.phase = 'model';
	build.log += 'asking the model what this folder holds\n';
	const analysis = await analyzeFolder(ctx, folder, inventory);
	if (!analysis.config) return analysis;

	// The picked folder is the root and the cache is the output, whatever the model
	// said: an answer that names a path outside the folder still cannot read one.
	analysis.config.sources = analysis.config.sources || {};
	analysis.config.sources.root = folder;
	analysis.config.sources.out = join(outDir, 'data');
	analysis.config._notes = (analysis.notes || []).slice();

	const analysedPath = join(outDir, 'analysed.config.json');
	await writeFile(analysedPath, JSON.stringify(analysis.config, null, 1), 'utf8');

	let finalPath = analysedPath;
	if (discoveredPath && (await exists(discoveredPath))) {
		// Merge, do not replace: see tools/merge_config.py. A model answer that
		// names the wrong workbook must not overwrite a sheet the reader opened.
		const merged = await run(
			[python, join(ROOT, 'tools', 'merge_config.py'), discoveredPath, analysedPath, cfgPath],
			ROOT,
		);
		build.log += merged.stdout + merged.stderr;
		if (merged.code === 0) {
			finalPath = cfgPath;
			const line = /^merged: (\d+) field/m.exec(merged.stdout || '');
			analysis.mergedFields = line ? Number(line[1]) : 0;
		}
	}
	if (finalPath !== cfgPath) await copyFile(finalPath, cfgPath);
	build.log += `the configuration was written by ${analysis.model}\n`;
	return analysis;
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
	if (!discoveredOk && !force) {
		throw new Error(`discovery failed (exit ${discover.code}): ${(discover.stderr || discover.stdout).trim().slice(-400)}`);
	}
	if (discoveredOk) {
		({ notes, found } = parseDiscoveryNotes(discover.stdout));
	} else {
		notes.push(`the reader could not describe this folder: ${(discover.stderr || discover.stdout).trim().slice(-300)}`);
	}

	if (!force) {
		const first = await runExtractor(python, cfgPath, outDir);
		if (first.result.code !== 0) {
			// A run that read most of the corpus and then tripped over one workbook is
			// a partial result, not a failed read: show whatever was written rather than
			// leaving the reader looking at the previous project.
			if (await exists(datasetPaths(first.built).data)) {
				notes.push(`the reader stopped early: ${(first.result.stderr || first.result.stdout).trim().slice(-300)}`);
				return { dir: first.built, notes, found, model, partial: true };
			}
			throw new Error(`extraction failed (exit ${first.result.code}): ${(first.result.stderr || first.result.stdout).trim().slice(-400)}`);
		}
		mergeExtractorNotes(first.result.stdout, notes);
		// Two ways to know the reader did not understand this folder: it recognised
		// nothing at all (no note about any record it found), or it recognised
		// something and every section still came out empty. Either way the page the
		// user would see is the one they reported as a failure, so ask the model
		// before giving up on the folder.
		if (found.length > 0 && !(await datasetIsEmpty(first.built))) {
			return { dir: first.built, notes, found, model };
		}
		build.log += 'nothing here matched the reader, asking the model\n';
	}

	const analysis = await analyzeConfig(
		ctx, python, folder, cfgPath, outDir,
		discoveredOk ? cfgPath : null,
	);
	model = analysis.model;
	for (const note of analysis.notes || []) if (!notes.includes(note)) notes.push(note);
	if (!analysis.config) {
		if (force && !discoveredOk) {
			throw new Error((analysis.notes || []).join('; ') || 'the model could not describe this folder');
		}
		if (!discoveredOk) {
			return { dir: join(outDir, 'data'), notes, found, model };
		}
		// The model had nothing to add but the reader's own answer still stands:
		// extract with what discovery wrote rather than failing the whole read.
		build.log += 'the model had nothing to add, using the reader\'s own answer\n';
	}

	const second = await runExtractor(python, cfgPath, outDir);
	if (second.result.code !== 0) {
		if (await exists(datasetPaths(second.built).data)) {
			notes.push(`the reader stopped early: ${(second.result.stderr || second.result.stdout).trim().slice(-300)}`);
			return { dir: second.built, notes, found, model, partial: true };
		}
		throw new Error(`extraction failed (exit ${second.result.code}): ${(second.result.stderr || second.result.stdout).trim().slice(-400)}`);
	}
	mergeExtractorNotes(second.result.stdout, notes);
	if (analysis.config) {
		const added = analysis.mergedFields != null ? ` (${analysis.mergedFields} field(s) added)` : '';
		found.push(`the layout was described by ${model}${added}`);
	}

	const paths = datasetPaths(second.built);
	if (!(await exists(paths.data)) || !(await exists(paths.index))) {
		throw new Error('the extractor finished without writing a dataset');
	}
	return { dir: second.built, notes, found, model };
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
	void startBuild(ctx, folder, { mode: wantsModel ? 'model' : 'reader' });
	json(res, 202, { status: 'running', folder, mode: wantsModel ? 'model' : 'reader' });
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
