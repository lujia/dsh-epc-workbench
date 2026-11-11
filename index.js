/**
 * EPC Project Workbench — host half.
 *
 * Serves the pre-extracted project dataset to the client half over two
 * read-only, same-origin routes:
 *
 *   GET /plugins/epc-workbench/data    → data/workbench.json
 *   GET /plugins/epc-workbench/index   → data/index.json
 *
 * Both files are produced offline by tools/build_data.py from the project
 * folder, so the host never touches Excel or the network at runtime: it reads
 * two JSON files off disk and caches them in memory.
 */
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const name = '@local/epc-workbench';

/** Absolute package root — this file lives at <root>/index.js. */
const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, 'data');

const ROUTE_PREFIX = '/plugins/epc-workbench';
const ROUTE_DATA = `${ROUTE_PREFIX}/data`;
const ROUTE_INDEX = `${ROUTE_PREFIX}/index`;

export const inject = ['webServer'];

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
 * Accept only requests addressed to this listener. The routes are read-only and
 * serve the same bytes to any local caller, so a host check is enough — no
 * origin dance is needed, and refusing means a stray `Host:` header from a
 * non-loopback page cannot probe the dataset.
 */
function hostIsLocal(req) {
	const host = req.headers.host;
	if (typeof host !== 'string' || host === '') return true;
	const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
	if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || hostname === '127.0.0.1') return true;
	if (/^127\./.test(hostname)) return true;
	return false;
}

/**
 * Read-once cache keyed by file path, invalidated when the extractor rewrites
 * the file. The dataset is rebuilt offline by tools/build_data.py, so without
 * the mtime check a running host would keep serving the previous parse until
 * the app restarts.
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

function serveFile(file) {
	return async (req, res) => {
		if (req.method !== 'GET' && req.method !== 'HEAD') {
			json(res, 405, { error: 'method not allowed' });
			return;
		}
		if (!hostIsLocal(req)) {
			json(res, 403, { error: 'host-not-trusted' });
			return;
		}
		try {
			const data = await loadJson(file);
			json(res, 200, data);
		} catch (error) {
			json(res, 503, {
				error: 'dataset-unavailable',
				message: `${safeMessage(error)} — run tools/build_data.py to build ${file}`,
			});
		}
	};
}

export function apply(ctx) {
	ctx.inject(['webServer'], (webCtx) => {
		webCtx.effect(() => {
			const disposeData = webCtx.webServer.register({
				kind: 'exact',
				path: ROUTE_DATA,
				handler: serveFile(join(DATA_DIR, 'workbench.json')),
			});
			const disposeIndex = webCtx.webServer.register({
				kind: 'exact',
				path: ROUTE_INDEX,
				handler: serveFile(join(DATA_DIR, 'index.json')),
			});
			return () => {
				disposeData();
				disposeIndex();
			};
		});
	});
}

export { name };
