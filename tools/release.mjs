#!/usr/bin/env node
/**
 * Cut a release: check the tree, pack the tarball, tag, push, and publish a GitHub
 * release with the tarball attached.
 *
 *   node tools/release.mjs              # do it
 *   node tools/release.mjs --dry-run    # everything except the tag, the push and gh
 *
 * The version is read from package.json and the tag is derived from it, so the two
 * cannot disagree — that is the point of the script rather than a checklist. Every
 * check below exists because it has caught a real mistake in this repository:
 *
 *   * a stale client.js — the bundle is generated, so it is easy to edit src/ and
 *     forget to rebuild, and the release then ships the previous page;
 *   * a dirty tree — the tag would point at a commit that is not what was tested;
 *   * a private file inside the package — workbench.config.json names a real client,
 *     and src/ and preview/ are development-only.
 *
 * Needs `git` and `gh` on PATH, with a token that can create releases (the `repo`
 * scope is enough for that; uploading a workflow file would need `workflow`, which
 * this script never does).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DRY = process.argv.includes('--dry-run');

const PROBLEMS = [];

function say(message) {
	console.log(message);
}

function fail(message) {
	PROBLEMS.push(message);
	console.error('  ✗ ' + message);
}

function step(title) {
	console.log('\n== ' + title);
}

/** Run a command and return its stdout, or throw with the output attached. */
function run(command, args, options = {}) {
	return execFileSync(command, args, {
		cwd: ROOT,
		encoding: 'utf8',
		stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
		env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
	}).trim();
}

/** Run a command for its exit status only; stdout is echoed on failure. */
function check(label, command, args) {
	try {
		const out = run(command, args);
		say('  ✓ ' + label + (out && out.length < 120 ? ' — ' + out.split('\n')[0] : ''));
		return true;
	} catch (error) {
		const detail = [error.stdout, error.stderr].filter(Boolean).join('\n').trim();
		fail(label + (detail ? ': ' + detail.split('\n').slice(-6).join('\n    ') : ''));
		return false;
	}
}

/** The python the harness ships, or whatever is on PATH. */
function python() {
	if (process.env.EPC_WORKBENCH_PYTHON) return process.env.EPC_WORKBENCH_PYTHON;
	const home = process.env.DSH_HOME || join(process.env.USERPROFILE || process.env.HOME || '', '.dsh');
	const candidates = [
		join(home, 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python', 'python.exe'),
		join(home, 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python', 'bin', 'python3'),
	];
	for (const candidate of candidates) if (existsSync(candidate)) return candidate;
	return process.platform === 'win32' ? 'python' : 'python3';
}

/**
 * The pnpm the harness ships, or whatever is on PATH.
 *
 * Neither node nor pnpm is on PATH on a machine where the Harness supplies them, so
 * resolving them here rather than assuming is what makes the script run at all. Node
 * comes from process.execPath, because the script is already running under it.
 */
function pnpm() {
	const home = process.env.DSH_HOME || join(process.env.USERPROFILE || process.env.HOME || '', '.dsh');
	const name = process.platform === 'win32' ? 'pnpm.cjs' : 'pnpm.cjs';
	const candidates = [
		join(home, 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'pnpm', 'bin', name),
		join(home, 'dsh-runtimes', 'dsh-primary-runtime', 'pnpm', 'bin', name),
	];
	for (const candidate of candidates) if (existsSync(candidate)) return candidate;
	return null;
}

/** Run pnpm through node when the shipped copy is found, else the PATH binary. */
function pnpmArgs(args) {
	const script = pnpm();
	if (script) return { command: process.execPath, args: [script].concat(args) };
	return { command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args: args };
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const version = manifest.version;
const tag = 'v' + version;

// ---------------------------------------------------------------- preconditions
step('Preconditions');
say('  package.json version ' + version + ' → tag ' + tag);

const dirty = run('git', ['status', '--porcelain']);
if (dirty) {
	fail('the tree is not clean — a tag must point at the commit that was tested:\n    '
		+ dirty.split('\n').slice(0, 12).join('\n    '));
} else {
	say('  ✓ the tree is clean');
}

const existing = run('git', ['tag', '--list', tag]);
if (existing) {
	fail('the tag ' + tag + ' already exists. Bump "version" in package.json for a new release,'
		+ ' or delete the tag if it was created by mistake.');
}

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') {
	fail('releases are cut from main (HEAD is on ' + branch + ')');
}

// ------------------------------------------------------------------- the checks
step('The committed bundle is the built bundle');
if (check('rebuild client.js', process.execPath, ['tools/build_client.mjs'])) {
	try {
		run('git', ['diff', '--quiet', '--', 'client.js']);
		say('  ✓ client.js matches src/client');
	} catch {
		fail('client.js does not match src/client — the generated bundle is stale.'
			+ ' Run "node tools/build_client.mjs" and commit the result.');
	}
}

step('The bundle parses and the views render');
check('node --check client.js', process.execPath, ['--check', 'client.js']);
check('node --check index.js', process.execPath, ['--check', 'index.js']);
check('node --check analyze.js', process.execPath, ['--check', 'analyze.js']);
check('tools/smoke.mjs', process.execPath, ['tools/smoke.mjs']);
check('tools/check_i18n.mjs', process.execPath, ['tools/check_i18n.mjs']);
check('python -m py_compile', python(), ['-m', 'py_compile',
	'tools/build_data.py', 'tools/epc_config.py', 'tools/discover_folder.py',
	'tools/inventory.py', 'tools/merge_config.py', 'tools/docread.py',
	'tools/merge_dataset.py', 'tools/evidence.py', 'tools/make_demo.py']);

// ------------------------------------------------------------------- the package
step('Pack');
const dist = join(ROOT, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
const pack = pnpmArgs(['pack', '--pack-destination', dist]);
check('pnpm pack', pack.command, pack.args);

const tarball = join(dist, 'dsh-epc-workbench-' + version + '.tgz');
if (!existsSync(tarball)) {
	fail('pnpm pack did not write ' + tarball);
}

step('The tarball carries what it should, and nothing it should not');
if (existsSync(tarball)) {
	try {
		const report = run(python(), ['-c', `
import json, os, sys, tarfile
path = sys.argv[1]
with tarfile.open(path, "r:gz") as tar:
    names = tar.getnames()
    members = set(names)
    manifest = json.load(tar.extractfile("package/package.json"))
problems = []
if manifest["version"] != sys.argv[2]:
    problems.append("package.json inside the tarball says " + manifest["version"])
for required in ("package/client.js", "package/index.js", "package/data/workbench.json",
                 "package/data/index.json", "package/cordis.patch.yml", "package/icon.svg",
                 "package/locale/en.json", "package/locale/zh.json"):
    if required not in members:
        problems.append("missing " + required)
for name in names:
    leaf = name.rsplit("/", 1)[-1]
    if leaf == "workbench.config.json":
        problems.append(name + " is the private configuration")
    for part in name.split("/"):
        if part in ("src", "preview", "__pycache__", "node_modules", ".git"):
            problems.append(name + " is a development folder")
            break
    if leaf.endswith((".pyc", ".log", ".tgz")):
        problems.append(name + " is a build leftover")
if problems:
    print("\\n".join(problems))
    sys.exit(1)
print("%d entries, %d bytes" % (len(names), os.path.getsize(path)))
`, tarball, version]);
		say('  ✓ ' + report.split('\n').slice(-1)[0] + ', version ' + version);
	} catch (error) {
		const detail = [error.stdout, error.stderr].filter(Boolean).join('\n').trim();
		fail('the tarball is not shippable:\n    ' + detail.split('\n').join('\n    '));
	}
}

// ---------------------------------------------------------------------- the tag
if (PROBLEMS.length > 0) {
	console.error('\n' + PROBLEMS.length + ' problem(s) — nothing was tagged, pushed or published.');
	process.exit(1);
}

if (DRY) {
	say('\n--dry-run: every check passed. The tag ' + tag + ', the push and the release were not made.');
	say('Run again without --dry-run to publish.');
	process.exit(0);
}

step('Tag and push');
check('create tag ' + tag, 'git', ['tag', '-a', tag, '-m', 'dsh-epc-workbench ' + version]);
check('push main', 'git', ['push', 'origin', 'main']);
check('push ' + tag, 'git', ['push', 'origin', tag]);

// ------------------------------------------------------------------ the release
step('Publish the GitHub release');
const repo = manifest.repository && manifest.repository.url
	? manifest.repository.url.replace(/^git\+/, '').replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '')
	: null;

const hasRelease = (() => {
	try {
		run('gh', ['release', 'view', tag, '--repo', repo]);
		return true;
	} catch {
		return false;
	}
})();

if (hasRelease) {
	check('replace the asset on the existing release', 'gh',
		['release', 'upload', tag, tarball, '--clobber', '--repo', repo]);
} else {
	check('create the release', 'gh', ['release', 'create', tag, tarball,
		'--title', 'dsh-epc-workbench ' + version, '--generate-notes', '--repo', repo]);
}

say('\ndone: https://github.com/' + repo + '/releases/tag/' + tag);
say('the tarball is at ' + tarball + ' and is attached to that release.');
say('publishing to npm is separate: pnpm publish --no-git-checks');
