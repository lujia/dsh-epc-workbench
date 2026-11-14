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

`discover_folder.py` prints one `note:` line per fact it could not establish and a final
`NOTES <json>` line that the interface reads back.

The host half caches the parsed dataset by file size and mtime, so a rebuild is picked
up on the next request. Changes to `index.js` itself need the bundle toggled off and on
in the plugin manager.

The folder reader looks for a Python with `openpyxl` in this order:
`EPC_WORKBENCH_PYTHON`, `$DSH_HOME/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe`,
that same runtime's `bin/python3`, then `python3` / `python` on `PATH`.

## Reading a folder from the interface

`POST /plugins/epc-workbench/folder` with `{"folder": "<absolute path>"}` starts a
background build and answers `202`; `GET /plugins/epc-workbench/state` reports
`{active, build}` with the extractor's tail output while it runs; `POST /plugins/epc-workbench/reset`
drops the folder and serves the bundled dataset again. The chosen folder is remembered in
`$DSH_HOME/cache/epc-workbench/state.json`, and a folder that no longer exists falls back
to the bundled dataset instead of breaking the page.

## Regenerating the demo dataset

`data/` in this repository is synthetic — see `tools/make_demo.py`. Regenerate it with:

```bash
python tools/make_demo.py
```

That overwrites `data/workbench.json` and `data/index.json` with the invented project
described above. Do not commit a dataset built from a real project: it contains
contract sums, party names and correspondence subjects.
