# Configuring the EPC workbench

The plugin ships with a demo dataset, so it renders the moment it is installed and
needs no configuration at all. This file explains how to point it at a real project.

For most projects you do not need to write any of it: press **Choose folder** above the
page and pick the project folder. `tools/discover_folder.py` derives everything below
from the records — parties, contracts, letter series, minute books, registers, sheets,
defect workbook, document folders, currencies — writes the result to
`$DSH_HOME/cache/epc-workbench/<hash>/workbench.config.json` and builds the dataset
beside it. The picked folder is only read. What discovery cannot establish is left
blank and reported on the page rather than guessed.

Write a configuration by hand when you want to override what discovery found, or when
the corpus is not laid out in a way discovery recognises. Everything project-specific
lives in one JSON file. `tools/epc_config.py` reads it, `tools/build_data.py` turns the
corpus it describes into `data/workbench.json` and `data/index.json`, and the client
renders whatever those two files contain. No party name, contract number or folder
name is compiled into the plugin.

## Where the file is looked up

1. the path given as the first argument — `python tools/build_data.py my-project.json`
2. the `WORKBENCH_CONFIG` environment variable
3. `workbench.config.json` in the package root
4. `workbench.config.example.json` in the package root, if that is all there is

Relative paths inside the file resolve against the file's own directory, so a config
can live next to the corpus and still work from any working directory. Keep the real
config out of version control: `.gitignore` already excludes `workbench.config.json`.

A discovered config keeps `letters` and `meetings` at the top level while a hand-written
one usually nests them under `sources`; both spellings are accepted.

## `project`

| Key | Meaning |
| --- | --- |
| `name` | Full project name, printed under the page header |
| `short` | Short caption, used in the topbar crumb |
| `mark` | Two to four letters for the topbar glyph and the favicon-ish square |
| `site` | Site description line |
| `standpoint` | Whose books are being read, e.g. the main contractor |
| `currency` | ISO code or symbol of the primary currency |
| `currencies` | Optional list of the currencies the contract is priced in; see below |

### `project.currencies`

A contract is often priced in more than one currency: imported plant in dollars, site
works in the local currency. The slices are additive, so the workbench prints all of
them rather than one converted total. Each entry tells it how a currency is spelled and
which field suffix carries its amount.

| Key | Meaning |
| --- | --- |
| `code` | Currency code, matched against `amounts[].code` |
| `label` | What the page prints, e.g. `US$` |
| `key` | Field suffix used in the payload (`Usd` gives `curUsd`, `grossCumUsd`, …) |
| `primary` | The one whose figure leads a tile and carries the progress percentages |

When the list is absent the workbench derives a single primary currency from
`project.currency`, which is the right answer for a single-currency project. Adding a
third currency later means one more entry here and one more set of suffixed fields in the
payload — no template change.

## `parties`

A list of the organisations the register strip can print. `id` is the key the rest of
the file refers to; `role` is one of `employer`, `contractor`, `subcontractor` and is
used to pick the translation for the role label.

| Key | Meaning |
| --- | --- |
| `id` | Lookup key, referenced by `contracts[].counterparty` |
| `name` | Current display name |
| `former` | Name carried by earlier records, printed as "formerly …" |
| `abbr` | Short form used in flows and pills |

Parties are optional in the sense that a missing list produces three neutral stubs,
but every real project should name them.

## `contracts`

One entry per contract the workbench can be read against — the main contract and each
subcontract package. The first `kind: "main"` entry is the default scope; every
`kind: "sub"` entry gets its own package in the register strip and its own finance tab.

| Key | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Lookup key, also the tag stored in the search index |
| `kind` | yes | `main` or `sub` |
| `no` | | Contract number as printed on documents |
| `label` | | Short label for the register tile and the scope switch |
| `tag` | | Token a document reference carries for this contract (`…-P01-…`); defaults to `id` |
| `counterparty` | | Party `id` on the other side of the contract |
| `currency` | | Defaults to `project.currency` |
| `value` | | Contract sum |
| `valueUsd` | | Second-currency slice of the sum, when the contract is measured in two |
| `valueRevised` | | Revised sum after a variation; the register quotes this when present |
| `originalValue` | | Original sum, printed beside the revised one |
| `advancePct` / `retentionPct` | | Percentages shown in the certificate bands |
| `issuer` | | Party `id` that issues the certificates |
| `dir` / `file` | | Subcontract retention workbook, relative to `sources.root` |
| `has_period` | | `false` when the retention sheet has no period column |

`counterparty` must be a declared party id, and every letter or meeting source must
name a declared contract id — both are checked when the file loads, so a typo fails
immediately rather than producing a half-empty page.

## `sources`

Where the records live, relative to `sources.root`.

| Key | Meaning |
| --- | --- |
| `root` | Corpus root; absolute, or relative to the config file |
| `out` | Output folder for the two JSON files, default `data` |
| `defects` | Defect register workbook |
| `paymentsRegister` | Workbook holding the payment sheets |
| `mainContractDir` | Folder of main-contract certificate workbooks |
| `mainContractSums` | Contract sums used to find each certificate's grand-total row; one per era of the contract |
| `scanPattern` | Regex with named groups `party` and `ref` for scanned certificate filenames |
| `sheets.ipc` / `sheets.employer` / `sheets.monthly` | Sheet names inside the payment register |
| `latestCertificate` | `{dir, file, sheet, itemsSheet}` of the certificate whose bill-of-quantities detail is shown |
| `docs` | `{contracts, toc, materials, photos, videos, pdfLetters}` folders |
| `letters` | List of `{dir, series, contract, side, label}` |
| `meetings` | List of `{dir, series, contract, label}` |

`series` is the internal key the index stores per row; `label` is what the interface
prints. Keeping them separate is what lets the same code serve two projects whose letter
series have different keys and different printed labels — the label is configuration, the
key is only a join.

Every source is optional. A key that is missing or points at a folder that does not
exist yields an empty section rather than an error, so a workbench can be built
incrementally: start with letters, add payments later.

## Building

```bash
python tools/build_data.py                 # uses workbench.config.json
python tools/build_data.py my-project.json # or an explicit file
node   tools/build_client.mjs              # only needed after editing src/client/*.js
```

From a bare folder, without writing a configuration first:

```bash
python tools/discover_folder.py <project-folder> out/workbench.config.json out/data
python tools/build_data.py out/workbench.config.json
```

`discover_folder.py` prints one `found:` line per record it recognised and one `gap:` line per
fact it could not establish, then two JSON lines the interface reads back: `NOTES` (the gaps)
and `FOUND` (what was read). The config it writes carries only the gaps — the extractor
replays its notes as warnings, and a success listed there would be reported twice and under
the wrong heading.

The host half caches the parsed dataset by file size and mtime, so a rebuild is picked
up on the next request. Changes to `index.js` itself need the bundle toggled off and on
in the plugin manager.

The folder reader looks for a Python with `openpyxl` in this order:
`EPC_WORKBENCH_PYTHON`, `$DSH_HOME/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe`,
that same runtime's `bin/python3`, then `python3` / `python` on `PATH`.

## A folder that is laid out differently

Every configured path is a preference, not a requirement. When a folder's records are named
or arranged differently the reader falls back, and says so:

| configured | fallback |
| --- | --- |
| `sources.paymentsRegister` | the workbook under the root (several levels down) that holds both an interim-payment sheet and a monthly-record sheet |
| `sources.defects` | the workbook whose sheet name reads like a defect register |
| sheet names in `sources.sheets` | a sheet whose name matches `interim payment to` / `subcontractor` / `interim payment from` / `employer` / `monthly` / `record` |
| `contracts[].dir` + `file` (retention) | the first workbook under that folder with a retention sheet, or the first sheet whose first column opens with an IPC number |
| `sources.latestCertificate` | the newest workbook whose filename carries an `IPC<n>` ordinal, preferring a sheet named `IPC-… (<n>)` and an item sheet mentioning a BOQ amount |
| `sources.mainContractDir` | a folder named like a main contract, employer, owner or client |
| `letters[].dir`, `meetings[].dir` | a folder found by walking the tree, whose first document reads like a letter or a minute |

A sheet name is matched after trimming spaces and case, so `GRAND SUM ` and `grand sum` are
the same sheet. A workbook that openpyxl cannot open is reported and skipped; it never stops
the build. Everything that was not read is listed for the reader, so an empty card is never
mistaken for a zero.

A document is matched by content too, and by any readable format: `.md`, `.txt`, `.docx` and
`.pdf` all go through `tools/docread.py`, so a folder of Word letters is a letter series and
not an empty one. The same document held twice (the scan and its OCR output) counts once,
and a folder cannot be both a letter series and a minute book — the second reading is
dropped rather than double-counting.

Currency is established from the register rather than from the first currency label the
workbook happens to print. Each payment block carries a tax column beside it (`VAT+SSCL
(LKR)`), and that label is the evidence for the currency of the figures in the block; the
project's primary currency is the one the register names more than once, because the tax
column is always local. This is why a package priced in rupees is not labelled in dollars
just because the main contract's foreign slice is printed above it.

Column order is a preference too. The payment register and the defect register are read
through their header row when one can be found in the first 25 rows: the reader maps each
field it wants (`invoice date`, `ipc amount`, `payment date`, `discipl…`, `target date`, …)
to whichever column carries that heading, so a register whose columns were arranged another
way still reads. When no header row is recognisable the reader keeps the positional layout it
was written against, and when the header puts a field somewhere unusual the strip says so
(`the columns are not in the usual order`).

## Reading a folder with the model

The two buttons in the project strip are two different readers:

| Button | For | Route |
| --- | --- | --- |
| **Choose folder** | a folder already laid out the way this workbench expects | `POST /folder` |
| **Analyze with model** | a folder that is not — letters in PDF or Word, records the reader cannot parse, a tree nobody organised | `POST /analyze` |

Both start with the deterministic reader. The assisted route then asks the model the harness
is running what the folder holds, and merges that answer over the reader's findings rather
than replacing them.

```bash
python tools/inventory.py <project-folder> out/inventory.json      # describe the folder
python tools/merge_config.py out/discovered.json out/analysed.json out/workbench.config.json
```

`tools/inventory.py` writes a bounded description: per-directory file counts and a few
sample names, the header block of a spread of documents, and the sheet names plus first rows
of a spread of workbooks. Ceilings (`MAX_WORKBOOKS`, `MAX_MARKDOWN`, …) keep it inside a
prompt, and the document records `truncated` / `dropped` rather than silently losing half the
corpus. Documents are read through `tools/docread.py`, which handles `.md`, `.txt`, `.docx`
and `.pdf`; a scanned PDF with no text layer is reported as such rather than read as noise.

`analyze.js` sends that description to `ctx.get('llm').stream(...)` on the route
`ctx.get('agentDefaultModel').currentSelection()` returns — the provider, model and
reasoning effort the conversation is already using — and reads back a configuration object.
`tidy()` then repairs only the answer's *formatting* (paths relative and forward-slashed,
numbers finite and positive, contract ids that exist).

`tools/merge_config.py` decides what survives. The rule is that a fact read out of a file
beats a judgement formed from a summary of the folder:

* the reader keeps every price, currency, sheet name, folder path and count it established;
* the model supplies what the reader could not recognise — a series under an unexpected
  name, a register the walker passed over — and the names it could only see as reference
  codes (`HALO`, `NORV` become the organisations on the letterheads);
* a contract's price and currency are never taken from the model;
* a series the reader found keeps its folder and series key; only its contract attribution
  and a role-guessed label may be corrected, because the model read the documents;
* two parties describing the same organisation are folded into one entry, and a contract
  that named the folded-away id is re-pointed at the survivor.

The extractor then runs against the merged configuration, so every figure on the page still
comes out of a file.

It runs automatically when the deterministic reader recognised nothing, and can be forced
from the interface:

```
POST /plugins/epc-workbench/analyze   {"folder": "<absolute path>"}
```

The same polling contract as `/folder`. The strip reports the outcome either way: a
successful analysis shows `layout by <model>`, and a failure shows the model's own reason
(`the model could not name a contract in this folder…`) rather than an empty page. Nothing
is invented: when the model cannot read the folder, the page says which parts are missing.

## Reading a folder from the interface

`POST /plugins/epc-workbench/folder` with `{"folder": "<absolute path>"}` starts a
background build and answers `202`; `POST /plugins/epc-workbench/analyze` takes the same
body and starts the model-assisted build. `GET /plugins/epc-workbench/state` reports
`{active, build}` with the extractor's tail output while it runs;
`POST /plugins/epc-workbench/reset` drops the folder and serves the bundled dataset again.
The chosen folder is remembered in `$DSH_HOME/cache/epc-workbench/state.json`, and a
folder that no longer exists falls back to the bundled dataset instead of breaking the
page.

### No folder is refused

Every build ends in a merged dataset, never in an error sentence. `runBuild` has one exit:
`tools/merge_dataset.py` is run over whatever the extractor wrote (an empty, correctly
shaped dataset is written first when the extractor produced nothing), and each section is
taken whole from the folder or whole from the bundled demo:

| payload field | meaning |
| --- | --- |
| `origins` | section → `folder` \| `demo` \| `empty` |
| `demoSections` | the sections standing in from the bundled dataset |
| `folderSections` | the sections the folder supplied |

Sections are `contracts`, `letters`, `meetings`, `defects`, `payments`, `retention`,
`certificate`, `mainContract`, `docs` and `project`. The index file is rebuilt to match:
rows of a kind whose section was substituted come from the demo, so the search palette and
the tables cannot disagree about what the project holds. The folder's own index rows are
copied verbatim — no de-duplication, because two letters may legitimately carry one
reference on one day and dropping either would make the record count lie.

Two rules make the mixed page honest:

* **A contract counts only when it has a real number.** `normalise()` fills a missing
  contract number with the contract id, so a folder that never named its contracts still
  arrives with `MAIN`/`MAIN`. `has_contracts()` rejects that placeholder; the register,
  the parties, the currencies and the project identity then come from the demo as a whole.
* **The series still come from the folder.** When the register is the demo's, the folder's
  letter series and minute books are kept and re-pointed at the demo's main contract, so
  eight real letters do not vanish behind a demo caption they did not come from.

The strip then shows `demo: <n>` beside the missing-part count; both open the same list,
which names the sections in each group.

## Regenerating the demo dataset

`data/` in this repository is synthetic — see `tools/make_demo.py`. Regenerate it with:

```bash
python tools/make_demo.py
```

That overwrites `data/workbench.json` and `data/index.json` with the invented project
described above. Do not commit a dataset built from a real project: it contains
contract sums, party names and correspondence subjects.
