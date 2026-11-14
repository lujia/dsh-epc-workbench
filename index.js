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
 * Routes, all same-origin under /plugins/epc-workbench:
 *
 *   GET  /data                    the dataset the client renders
 *   GET  /index                   the search index that belongs to it
 *   GET  /state                   what is being served, and how the build is going
 *   POST /folder   {folder}        read that folder; answers as soon as it starts
 *   POST /reset                   go back to the bundled dataset
 */
import { spawn } from 'node:child_process';
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
};

const build = {
	status: 'idle',
	folder: null,
	startedAt: null,
	finishedAt: null,
	error: null,
	log: '',
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
			JSON.stringify({ dir: active.dir, source: active.source, folder: active.folder, builtAt: active.builtAt, notes: active.notes }, null, 1),
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

/** The python scripts that do the reading, and the folder they read. */
async function runBuild(folder) {
	const python = await findPython();
	const outDir = join(cacheRoot(), createHash('sha1').update(folder).digest('hex').slice(0, 12));
	await mkdir(outDir, { recursive: true });
	const cfgPath = join(outDir, 'workbench.config.json');

	build.log = '';
	const discover = await run(
		[python, join(ROOT, 'tools', 'discover_folder.py'), folder, cfgPath, join(outDir, 'data')],
		ROOT,
	);
	build.log += discover.stdout + discover.stderr;
	if (discover.code !== 0) {
		throw new Error(`discovery failed (exit ${discover.code}): ${(discover.stderr || discover.stdout).trim().slice(-400)}`);
	}
	const notesLine = discover.stdout.split(/\r?\n/).find((line) => line.startsWith('NOTES '));
	let notes = [];
	if (notesLine) {
		try {
			notes = JSON.parse(notesLine.slice(6));
		} catch {
			notes = [];
		}
	}

	const extract = await run([python, join(ROOT, 'tools', 'build_data.py'), cfgPath], ROOT);
	build.log += extract.stdout + extract.stderr;
	if (extract.code !== 0) {
		throw new Error(`extraction failed (exit ${extract.code}): ${(extract.stderr || extract.stdout).trim().slice(-400)}`);
	}

	const built = join(outDir, 'data');
	const paths = datasetPaths(built);
	if (!(await exists(paths.data)) || !(await exists(paths.index))) {
		throw new Error('the extractor finished without writing a dataset');
	}
	return { dir: built, notes, log: extract.stdout };
}

async function startBuild(folder) {
	if (building !== null) return building;
	build.status = 'running';
	build.folder = folder;
	build.startedAt = new Date().toISOString();
	build.finishedAt = null;
	build.error = null;
	build.log = '';
	building = (async () => {
		try {
			const result = await runBuild(folder);
			active.dir = result.dir;
			active.source = 'folder';
			active.folder = folder;
			active.builtAt = new Date().toISOString();
			active.notes = result.notes;
			// Drop every cached parse: the same path can be rebuilt with new numbers.
			cache.clear();
			build.status = 'ready';
			build.log = result.log;
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
		},
		build: {
			status: build.status,
			folder: build.folder,
			startedAt: build.startedAt,
			finishedAt: build.finishedAt,
			error: build.error,
			progress: build.log.slice(-1200),
		},
	});
}

async function handleFolder(req, res) {
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
	void startBuild(folder);
	json(res, 202, { status: 'running', folder });
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
						void handleFolder(req, res);
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
