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
and a few file names each, the header block of a sample of markdown documents, and
the sheet names plus the first rows of a sample of workbooks.

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
   is the subcontractor, and any former names the records show.
8. The contract numbers, and the price in each currency if the records state it.

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
 * One auxiliary model call, assembled to text.
 *
 * `purpose` is transport metadata the adapter carries for attribution; the model
 * never sees it. The route comes from the caller because the harness knows which
 * model the user is on and this module does not.
 */
async function askModel(llm, route, inventory, signal) {
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
					{ type: 'text', text: `${PROMPT_TASK}\n\n${PROMPT_SCHEMA}\n\nINVENTORY\n${JSON.stringify(inventory)}` },
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
function tidy(raw, folder) {
	const config = { project: {}, parties: [], contracts: [], sources: {}, letters: [], meetings: [] };
	const project = raw.project && typeof raw.project === 'object' ? raw.project : {};
	// A model that could read the records and still leave the caption blank would
	// hand back a page whose topbar says nothing at all. The folder name is not a
	// claim about the project, so it is a safe thing to fall back to; the model's
	// answer wins whenever it gave one.
	const base = String(folder || '').split(/[\\/]/).filter(Boolean).pop() || '';
	const name = String(project.name || '').slice(0, 120) || base;
	const mark = String(project.mark || '').toUpperCase().slice(0, 6) || initials(name) || 'EPC';
	config.project = {
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
						label: String(c.label || c.code).slice(0, 12),
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
 * Ask the model to describe the folder.
 *
 * Returns `{ config, model, notes }` — `config` is null when the model answered
 * with something that is not a usable configuration, and `notes` always says why
 * so the page can report the failure instead of silently showing the empty result
 * the user was already looking at.
 */
export async function analyzeFolder(ctx, folder, inventory) {
	const llm = typeof ctx.get === 'function' ? ctx.get('llm') : null;
	if (!llm || typeof llm.stream !== 'function') {
		return { config: null, model: null, notes: ['the model is not available in this installation, so the folder was read without it'] };
	}
	let route = null;
	try {
		const defaults = typeof ctx.get === 'function' ? ctx.get('agentDefaultModel') : null;
		if (defaults && typeof defaults.currentSelection === 'function') route = defaults.currentSelection();
	} catch {
		route = null;
	}
	if (!route || !route.provider || !route.model) {
		return { config: null, model: null, notes: ['no model is selected, so the folder was read without one'] };
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 240000);
	let answer;
	try {
		answer = await askModel(llm, route, inventory, controller.signal);
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
