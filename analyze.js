import fs from 'node:fs';
import path from 'node:path';

/**
 * Turn a description of a project folder into a workbench config, using the model
 * the harness is already running.
 *
 * The deterministic reader in `tools/epc_config.py` recognises one corpus layout:
 * letter folders named `md_Letters_issued_to_…`, a register workbook with an
 * `Interim Payment to …` sheet, certificates named `…-IPC-52.xlsx`. A folder that
 * holds the same records under other names defeats it completely, and the page
 * comes up empty — which reads as a broken plugin rather than as an unrecognised
 * layout.
 *
 * So when the reader finds nothing, this module hands a bounded inventory of the
 * folder to the current model and asks for the configuration instead. The model
 * sees folder names, file names, the header block of a sample of letters and the
 * sheet names with the first rows of a sample of workbooks — the same evidence a
 * person would use to decide which folder is which series.
 *
 * Two rules shape the prompt:
 *
 *   - Nothing may be invented. A number the model cannot see in the inventory is
 *     left out, because the workbench already has a way to say "not in this
 *     folder" and a plausible-looking wrong figure is worse than a blank.
 *   - The answer is JSON and nothing else, so a stray sentence cannot turn into a
 *     parse failure three layers down.
 */

const PROMPT_SCHEMA = `The workbench reads a JSON configuration. Its fields:

project      { name, short, mark, site, standpoint, currency, currencies[] }
             name is the works, not the folder name. mark is 2-4 capitals shown in
             the topbar. standpoint is the organisation whose side the workbench
             reads from (the one sending the letters it issued).
             currencies[] is [{ code, label, primary }] — every currency the
             contract is priced in, not conversions of one another.
parties[]    { id, name, former, abbr, role }
             ids are yours to choose but must be used consistently by contracts.
             former is the name this party used earlier in the project, when the
             records show a rename.
contracts[]  { id, kind, no, label, tag, counterparty, currency, value, valueUsd,
               valueRevised, originalValue, originalValueUsd, advancePct,
               retentionPct, dir, file, has_period }
             kind is "main" or "sub". no is the contract number as printed.
             tag is the token a document reference carries for this contract
             (a letter called …-P01-… belongs to the contract whose tag is P01).
             counterparty is a party id. dir+file point at this contract's
             retention workbook, relative to the folder. has_period says whether
             that workbook has a period column.
             value is the price in the contract's own primary currency, as a plain
             number with no separators: LKR 1,881,773,646.24 becomes 1881773646.24.
             valueUsd is a SECOND SLICE of the same price when the contract is
             priced in two currencies, not a conversion of value. A contract
             stated as "USD 13,772,186.01 and LKR 1,881,773,646.24" has both.
             valueRevised is the price after the variations the documents record;
             originalValue is the price before them.
             advancePct and retentionPct are percentages as numbers (15, 10).
sources      { defects, paymentsRegister, mainContractDir, sheets, latestCertificate, docs }
             defects            path of the defect register workbook
             paymentsRegister   path of the interim-payment register workbook
             mainContractDir    folder holding the main-contract certificates
             sheets             { ipc, employer, monthly } sheet names in that
                                register: payments to the subcontractor, payments
                                from the employer, and the monthly summary
             latestCertificate  { dir, file, sheet, itemsSheet } for the newest
                                subcontract certificate
             docs               { contracts, toc, materials, photos, videos, pdfLetters }
letters[]    { dir, series, contract, side, label }
             one entry per letter series folder. side is "issued" or "received".
             contract is a contract id. series is a short stable key you choose.
meetings[]   { dir, series, contract, label }
             one entry per folder of meeting minutes.

All paths are relative to the project folder and use forward slashes.
Omit any field you cannot establish from the inventory. Do not guess numbers.`;

const PROMPT_TASK = `Below is an inventory of a project folder: the folders with their file counts
and a few file names each, the header block of a sample of documents, and the sheet
names plus the first rows of a sample of workbooks.

Some documents carry an "evidence" block as well. It is not a summary: it is the
passages a full read of that document found for amounts, parties, priced terms and
contract numbers, with the text around each one. A contract states its price on
page three, so the header block of sixteen lines never shows it and the evidence
block is the only place it appears. Read every evidence block you are given.

Decide what this corpus is and return the configuration that reads it. Work out:

1. Which folders hold letter series, which side each series is (letters this
   project sent, or letters it received), and which contract each belongs to.
2. Which folders hold meeting minutes.
3. Which workbook is the interim-payment register and which sheets inside it are
   the subcontract payments, the employer payments and the monthly summary.
4. Which workbook is the defect register.
5. Which folder holds the main-contract certificates, if there is one.
6. Which contract's retention workbook is where, and whether it has a period column.
7. The parties: who is the employer, who is the contractor (the standpoint), who
   is the subcontractor, and any former names the records show. Use the full name
   the document gives, not the reference code: an evidence block that reads
   "between Acme Industrial Works (hereinafter "the Contractor")"
   is telling you who the contractor is.
8. The contract numbers, and the price in each currency, from the evidence blocks.
   When an addendum states a variation, work out the revised price and record it as
   valueRevised with the original as originalValue. When a contract is priced in two
   currencies, put the primary in value and the second slice in valueUsd.
9. The currencies: every one the contracts are priced in, with the local currency
   (the one the tax columns are kept in) marked primary.

A folder of contracts only — no letters, no payments — is a complete answer to this
task: report the contracts, their parties and their prices, and leave the sections
the folder does not hold empty.

Answer with one JSON object shaped exactly like the schema above. No prose, no
markdown fence, no comments.`;

const SYSTEM = `You configure a project-controls workbench from evidence about a folder. You answer
with a single JSON object and nothing else. You never invent a value: a field you
cannot establish from the evidence is omitted, because the workbench can report a
missing section but cannot detect a fabricated one.`;

/** A JSON object out of a model answer, with or without a markdown fence. */
function extractJson(text) {
	const raw = String(text || '').trim();
	if (raw === '') return null;
	const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
	const body = fenced ? fenced[1] : raw;
	const start = body.indexOf('{');
	const end = body.lastIndexOf('}');
	if (start < 0 || end <= start) return null;
	try {
		return JSON.parse(body.slice(start, end + 1));
	} catch {
		return null;
	}
}

/**
 * What this particular call is looking at.
 *
 * The folder is read one subject at a time, so each call sees the inventory of one
 * subfolder and is told which. Without that framing a model shown only the
 * `drawings` inventory still answers with a whole project — a name, a contract
 * number, a price — reconstructed from the folder path, and the merge has no way to
 * tell that guess from something the drawings actually stated.
 */
function subfolderNote(subfolder, index, total) {
	if (!subfolder) return '';
	const position = total > 0 ? ` (subfolder ${index} of ${total})` : '';
	return `This call covers ONE subfolder of the project: \`${subfolder}\`${position}. The inventory below describes that subfolder only. Report only what these files establish, and omit every field they do not: the other subfolders are being read separately and their answers are merged with this one. A field this subfolder cannot evidence is a field to leave out, not a field to reconstruct from the project name.`;
}

/**
 * One auxiliary model call, assembled to text.
 *
 * `purpose` is transport metadata the adapter carries for attribution; the model
 * never sees it. The route comes from the caller because the harness knows which
 * model the user is on and this module does not.
 */
async function askModel(llm, route, inventory, signal, subfolder = '', index = 0, total = 0) {
	let text = '';
	let finish = null;
	const stream = llm.stream({
		provider: route.provider,
		model: route.model,
		...(route.reasoningEffort ? { reasoningEffort: route.reasoningEffort } : {}),
		system: SYSTEM,
		maxTokens: 8000,
		temperature: 0,
		purpose: 'epc-workbench-analysis',
		signal,
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'text',
						text: `${subfolderNote(subfolder, index, total)}\n\n${PROMPT_TASK}\n\n${PROMPT_SCHEMA}\n\nINVENTORY\n${JSON.stringify(inventory)}`,
					},
				],
			},
		],
	});
	for await (const chunk of stream) {
		if (chunk.type === 'text-delta') text += chunk.text;
		else if (chunk.type === 'finish') finish = chunk.reason;
	}
	return { text, finish };
}

/**
 * Re-anchor the paths in one answer onto the project root.
 *
 * Each call covers one subfolder, so a model shown the inventory of `contracts`
 * answers with `NGA_MAIN` — the name it was given — while the extractor resolves
 * every path against the project root, where that folder is `contracts/NGA_MAIN`.
 * Without this the main-contract certificates are searched for in a folder that does
 * not exist, and a contracts-only project reports no contract price at all.
 *
 * The check is the filesystem's, not a guess: a path is re-anchored only when it
 * exists under the subfolder and not at the root. An answer that already named the
 * full path, or one naming something nowhere, is left exactly as it came.
 */
function reanchor(config, subfolder, folder) {
	if (!subfolder || !config || !config.sources) return config;
	const exists = (rel) => {
		if (!rel) return false;
		try {
			return fs.existsSync(path.join(folder, rel));
		} catch {
			return false;
		}
	};
	const fix = (rel) => {
		const value = cleanRel(rel);
		if (value === '' || exists(value)) return value;
		const joined = subfolder + '/' + value;
		return exists(joined) ? joined : value;
	};
	const sources = config.sources;
	sources.defects = fix(sources.defects);
	sources.paymentsRegister = fix(sources.paymentsRegister);
	sources.mainContractDir = fix(sources.mainContractDir);
	if (sources.latestCertificate) sources.latestCertificate.dir = fix(sources.latestCertificate.dir);
	if (sources.docs) {
		for (const key of Object.keys(sources.docs)) sources.docs[key] = fix(sources.docs[key]);
	}
	for (const key of ['letters', 'meetings']) {
		for (const entry of config[key] || []) entry.dir = fix(entry.dir);
	}
	return config;
}

/** Keep only the paths the extractor can use, so a model typo cannot escape the folder. */
function cleanRel(value) {
	if (typeof value !== 'string') return '';
	const text = value.replace(/\\/g, '/').trim().replace(/^\.?\//, '');
	if (text === '' || text.includes('..')) return '';
	return text;
}

/** A two-to-four letter mark from a project name, for the topbar glyph. */
function initials(name) {
	const words = String(name || '')
		.split(/[^\p{L}\p{N}]+/u)
		.filter((w) => w.length > 0 && !/^(the|of|and|for|a|an)$/i.test(w));
	if (words.length === 0) return '';
	if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
	return words
		.slice(0, 4)
		.map((w) => w[0])
		.join('')
		.toUpperCase();
}

/**
 * Repair the parts of a model answer that would make the extractor fail outright,
 * and leave everything else alone.
 *
 * The extractor is tolerant of a *missing* path but not of a *malformed* one, and
 * a model that answers with an absolute path or a Windows separator is right about
 * the meaning and wrong about the syntax. Fixing the syntax here keeps the model's
 * judgement and discards only its formatting.
 */
/* The currencies whose symbol is worth printing. The interface puts the currency
 * beside a figure in a fixed-width column; a written-out name is either cut short
 * ("Almar Rupee") or pushes the amount out of its tile ("US Dollar"). A symbol
 * is one or two characters and reads the same in both languages. */
const CURRENCY_SYMBOLS = {
	USD: 'US$',
	LKR: 'LKR',
	EUR: '€',
	GBP: '£',
	JPY: 'JPY',
	CNY: 'CNY',
	RMB: 'CNY',
	AUD: 'A$',
	SGD: 'S$',
	INR: 'INR',
	PKR: 'PKR',
	BDT: 'BDT',
	MYR: 'MYR',
	THB: 'THB',
	SAR: 'SAR',
	AED: 'AED',
	QAR: 'QAR',
	KRW: 'KRW',
	CHF: 'CHF',
};

function tidy(raw, folder) {
	const config = { project: {}, parties: [], contracts: [], sources: {}, letters: [], meetings: [] };
	const project = raw.project && typeof raw.project === 'object' ? raw.project : {};
	// A model that could read the records and still leave the caption blank would
	// hand back a page whose topbar says nothing at all. The folder name is not a
	// claim about the project, so it is a safe thing to fall back to; the model's
	// answer wins whenever it gave one.
	const base = String(folder || '').split(/[\\/]/).filter(Boolean).pop() || '';
	const named = String(project.name || '').slice(0, 120);
	const name = named || base;
	const mark = String(project.mark || '').toUpperCase().slice(0, 6) || initials(name) || 'EPC';
	config.project = {
		// Whether the caption is the model's or the folder's own name. A merge of
		// ten subfolder answers has to prefer the one a model actually stated: the
		// drawings folder cannot name the project, and taking its answer because it
		// came first would caption a whole project `drawings`.
		_fromFolder: named === '',
		name,
		short: String(project.short || '').slice(0, 60) || name.slice(0, 60),
		mark,
		site: String(project.site || '').slice(0, 120),
		standpoint: String(project.standpoint || '').slice(0, 60),
		currency: String(project.currency || '').toUpperCase().slice(0, 8),
		currencies: Array.isArray(project.currencies)
			? project.currencies
					.filter((c) => c && typeof c === 'object' && c.code)
					.map((c) => ({
						code: String(c.code).toUpperCase().slice(0, 8),
						// A currency label is printed beside a figure inside a KPI
						// tile, so it has to be a symbol or a very short token. A
						// model that answers with the written-out name ("Almar
						// Rupees", "United States Dollars") has read the document
						// correctly and produced a label that cannot be printed: the
						// figure column is fixed, and "US Dollar" pushes the amount
						// off the tile. Well-known codes get their symbol; anything
						// else falls back to the code itself, which is never wrong.
						label: CURRENCY_SYMBOLS[String(c.code).toUpperCase()] ||
							(String(c.label || '').length <= 4 ? String(c.label) : String(c.code).toUpperCase().slice(0, 8)),
						primary: Boolean(c.primary),
					}))
			: [],
	};

	const partyIds = new Set();
	for (const p of Array.isArray(raw.parties) ? raw.parties : []) {
		if (!p || typeof p !== 'object' || !p.id) continue;
		const id = String(p.id).slice(0, 40);
		if (partyIds.has(id)) continue;
		partyIds.add(id);
		config.parties.push({
			id,
			name: String(p.name || id).slice(0, 120),
			former: String(p.former || '').slice(0, 120),
			abbr: String(p.abbr || '').slice(0, 12),
			role: String(p.role || id).slice(0, 40),
		});
	}

	const contractIds = new Set();
	for (const c of Array.isArray(raw.contracts) ? raw.contracts : []) {
		if (!c || typeof c !== 'object' || !c.id) continue;
		const id = String(c.id).slice(0, 40);
		if (contractIds.has(id)) continue;
		contractIds.add(id);
		const entry = {
			id,
			kind: c.kind === 'main' ? 'main' : 'sub',
			no: String(c.no || id).slice(0, 80),
			label: String(c.label || id).slice(0, 60),
			tag: String(c.tag || id).slice(0, 20),
			counterparty: String(c.counterparty || '').slice(0, 40),
			currency: String(c.currency || '').toUpperCase().slice(0, 8),
			dir: cleanRel(c.dir),
			file: cleanRel(c.file),
			has_period: c.has_period !== false,
		};
		for (const key of ['value', 'valueUsd', 'valueRevised', 'originalValue', 'originalValueUsd']) {
			const n = Number(c[key]);
			if (Number.isFinite(n) && n > 0) entry[key] = n;
		}
		for (const key of ['advancePct', 'retentionPct']) {
			const n = Number(c[key]);
			if (Number.isFinite(n) && n > 0) entry[key] = n;
		}
		config.contracts.push(entry);
	}
	if (config.contracts.length === 0) return null;

	const sources = raw.sources && typeof raw.sources === 'object' ? raw.sources : {};
	config.sources = {
		// The picked folder is the root the extractor resolves everything against,
		// and the dataset is written outside it. Both are ours to set, not the
		// model's, so an answer that gets them wrong still cannot read elsewhere.
		root: folder,
		defects: cleanRel(sources.defects),
		paymentsRegister: cleanRel(sources.paymentsRegister),
		mainContractDir: cleanRel(sources.mainContractDir),
		sheets: {},
		latestCertificate: {},
		docs: {},
	};
	const sheets = sources.sheets && typeof sources.sheets === 'object' ? sources.sheets : {};
	for (const key of ['ipc', 'employer', 'monthly']) {
		config.sources.sheets[key] = String(sheets[key] || '').slice(0, 80);
	}
	const latest = sources.latestCertificate && typeof sources.latestCertificate === 'object' ? sources.latestCertificate : {};
	config.sources.latestCertificate = {
		dir: cleanRel(latest.dir),
		file: cleanRel(latest.file),
		sheet: String(latest.sheet || '').slice(0, 80),
		itemsSheet: String(latest.itemsSheet || '').slice(0, 80),
	};
	const docs = sources.docs && typeof sources.docs === 'object' ? sources.docs : {};
	for (const key of ['contracts', 'toc', 'materials', 'photos', 'videos', 'pdfLetters']) {
		config.sources.docs[key] = cleanRel(docs[key]);
	}

	const mainId = (config.contracts.find((c) => c.kind === 'main') || config.contracts[0]).id;
	for (const s of Array.isArray(raw.letters) ? raw.letters : []) {
		if (!s || typeof s !== 'object') continue;
		const dir = cleanRel(s.dir);
		if (dir === '') continue;
		const contract = contractIds.has(String(s.contract)) ? String(s.contract) : mainId;
		config.letters.push({
			dir,
			series: String(s.series || dir).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 60),
			contract,
			side: s.side === 'received' ? 'received' : 'issued',
			label: String(s.label || dir).slice(0, 80),
		});
	}
	for (const s of Array.isArray(raw.meetings) ? raw.meetings : []) {
		if (!s || typeof s !== 'object') continue;
		const dir = cleanRel(s.dir);
		if (dir === '') continue;
		const contract = contractIds.has(String(s.contract)) ? String(s.contract) : mainId;
		config.meetings.push({
			dir,
			series: String(s.series || dir).slice(0, 60),
			contract,
			label: String(s.label || dir).slice(0, 80),
		});
	}

	// A party a contract names but the parties table forgot is the extractor's
	// problem to report, not a reason to drop the contract.
	return config;
}

/**
 * Fold several partial configurations into one.
 *
 * The folder is read one subject at a time, so each call answers about one survey:
 * the contracts folder states the contract numbers and the prices, the payments
 * folder states the register and the certificates, the letters folder states which
 * series exist and which side each is. None of them alone describes the project,
 * and all of them together do.
 *
 * The rules are the ones a person would use putting ten memos on a desk:
 *
 *   - a scalar is taken from the first answer that states it, because a later
 *     answer that repeats a contract number has read the same document;
 *   - an identified list (parties, contracts, letters, meetings) keeps every entry,
 *     merging by id, so two folders naming the same contract do not produce two;
 *   - a field only one answer can establish is taken from that answer, and a
 *     caption the folder invented is replaced by one a model stated.
 *
 * Nothing is invented here: a value that appears in none of the answers stays
 * absent, and the section it belonged to is reported blank.
 */
export { reanchor };

export function mergeConfigs(configs) {
	const live = (configs || []).filter((c) => c && typeof c === 'object');
	if (live.length === 0) return null;
	const merged = { project: {}, parties: [], contracts: [], sources: { sheets: {}, latestCertificate: {}, docs: {} }, letters: [], meetings: [] };

	const project = {};
	for (const key of ['name', 'short', 'mark', 'site', 'standpoint', 'currency']) {
		for (const c of live) {
			const value = c.project ? c.project[key] : '';
			if (typeof value === 'string' && value.trim() !== '') { project[key] = value; break; }
		}
	}
	// A caption the folder made up is the last resort: prefer any answer whose name a
	// model actually stated, so reading `drawings` first cannot caption the project.
	const named = live.filter((c) => c.project && c.project._fromFolder === false && c.project.name);
	if (named.length > 0) {
		project.name = named[0].project.name;
		if (named[0].project.short) project.short = named[0].project.short;
		if (named[0].project.mark) project.mark = named[0].project.mark;
	}
	const currencies = [];
	const seenCurrency = new Set();
	for (const c of live) {
		for (const cur of (c.project && c.project.currencies) || []) {
			if (!cur || !cur.code || seenCurrency.has(cur.code)) continue;
			seenCurrency.add(cur.code);
			currencies.push(cur);
		}
	}
	// Exactly one primary: the first answer's choice stands, and everything else is a
	// second slice. Two primaries would print the same figure twice on the money band.
	if (currencies.length > 0) {
		const primary = currencies.find((c) => c.primary) || currencies[0];
		for (const cur of currencies) cur.primary = cur === primary;
	}
	project.currencies = currencies;
	merged.project = project;

	const byId = (list, key) => {
		const out = new Map();
		for (const item of list || []) {
			if (!item || !item[key]) continue;
			const id = String(item[key]);
			const current = out.get(id);
			if (!current) { out.set(id, Object.assign({}, item)); continue; }
			// Later answers fill blanks and leave what is already known: the folder
			// that stated a price is right about it, and a folder that only repeated
			// the contract number has nothing to add.
			for (const [k, v] of Object.entries(item)) {
				if (k === key) continue;
				const mine = current[k];
				if (mine === undefined || mine === null || mine === '' || (Array.isArray(mine) && mine.length === 0)) current[k] = v;
			}
		}
		return [...out.values()];
	};
	merged.parties = byId(live.flatMap((c) => c.parties || []), 'id');
	merged.contracts = byId(live.flatMap((c) => c.contracts || []), 'id');

	for (const c of live) {
		const sources = c.sources || {};
		for (const key of ['defects', 'paymentsRegister', 'mainContractDir']) {
			if (!merged.sources[key] && sources[key]) merged.sources[key] = sources[key];
		}
		for (const key of ['ipc', 'employer', 'monthly']) {
			const value = sources.sheets ? sources.sheets[key] : '';
			if (!merged.sources.sheets[key] && value) merged.sources.sheets[key] = value;
		}
		for (const key of ['dir', 'file', 'sheet', 'itemsSheet']) {
			const value = sources.latestCertificate ? sources.latestCertificate[key] : '';
			if (!merged.sources.latestCertificate[key] && value) merged.sources.latestCertificate[key] = value;
		}
		for (const key of ['contracts', 'toc', 'materials', 'photos', 'videos', 'pdfLetters', 'drawings']) {
			const value = sources.docs ? sources.docs[key] : '';
			if (!merged.sources.docs[key] && value) merged.sources.docs[key] = value;
		}
	}

	// Two folders can describe the same letter series under different keys. The
	// directory is the identity, so it is what decides whether an entry is new.
	const seenDir = new Set();
	for (const c of live) {
		for (const item of [...(c.letters || []), ...(c.meetings || [])]) {
			if (!item || !item.dir) continue;
			const bucket = (c.letters || []).includes(item) ? merged.letters : merged.meetings;
			const key = bucket === merged.letters ? 'letter:' + item.dir : 'minute:' + item.dir;
			if (seenDir.has(key)) continue;
			seenDir.add(key);
			bucket.push(item);
		}
	}
	return merged;
}

/**
 * Ask the model to describe the folder.
 *
 * Returns `{ config, model, notes }` — `config` is null when the model answered
 * with something that is not a usable configuration, and `notes` always says why
 * so the page can report the failure instead of silently showing the empty result
 * the user was already looking at.
 */
export async function analyzeFolder(ctx, folder, inventory, options = {}) {
	const llm = typeof ctx.get === 'function' ? ctx.get('llm') : null;
	if (!llm || typeof llm.stream !== 'function') {
		return { config: null, model: null, notes: ['the model is not available in this installation, so the folder was read without it'] };
	}
	// The route is the caller's choice when it made one: the picker in the strip
	// lets a reader run the extraction on a model they picked, and a picker whose
	// answer was ignored would be worse than no picker. The session's own model is
	// the fallback, so the button still works when nothing was chosen.
	let route = options.route && options.route.provider && options.route.model ? options.route : null;
	if (!route) {
		try {
			const defaults = typeof ctx.get === 'function' ? ctx.get('agentDefaultModel') : null;
			if (defaults && typeof defaults.currentSelection === 'function') route = defaults.currentSelection();
		} catch {
			route = null;
		}
	}
	if (!route || !route.provider || !route.model) {
		return { config: null, model: null, notes: ['no model is selected, so the folder was read without one'] };
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 240000);
	let answer;
	try {
		answer = await askModel(llm, route, inventory, controller.signal, options.subfolder || '', options.index || 0, options.total || 0);
	} catch (error) {
		return {
			config: null,
			model: `${route.provider}/${route.model}`,
			notes: [`the model could not be asked about this folder: ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`],
		};
	} finally {
		clearTimeout(timer);
	}

	if (answer.finish && answer.finish.kind !== 'stop' && answer.finish.kind !== 'max-tokens') {
		const failure = answer.finish.failure ? ` (${answer.finish.failure.code || 'failed'})` : '';
		return {
			config: null,
			model: `${route.provider}/${route.model}`,
			notes: [`the model stopped before it finished reading this folder${failure}`],
		};
	}
	const raw = extractJson(answer.text);
	if (!raw) {
		return {
			config: null,
			model: `${route.provider}/${route.model}`,
			notes: ['the model answered with something that is not a configuration, so the folder was read without it'],
		};
	}
	const config = tidy(raw, folder);
	if (!config) {
		return {
			config: null,
			model: `${route.provider}/${route.model}`,
			notes: ['the model could not name a contract in this folder, so the folder was read without it'],
		};
	}
	return { config, model: `${route.provider}/${route.model}`, notes: [] };
}
