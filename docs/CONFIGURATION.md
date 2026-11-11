# Configuring the EPC workbench

The plugin ships with a demo dataset, so it renders the moment it is installed and
needs no configuration at all. This file explains how to point it at a real project.

Everything project-specific lives in one JSON file. `tools/epc_config.py` reads it,
`tools/build_data.py` turns the corpus it describes into `data/workbench.json` and
`data/index.json`, and the client renders whatever those two files contain. No party
name, contract number or folder name is compiled into the plugin.

## Where the file is looked up

1. the path given as the first argument — `python tools/build_data.py my-project.json`
2. the `WORKBENCH_CONFIG` environment variable
3. `workbench.config.json` in the package root
4. `workbench.config.example.json` in the package root, if that is all there is

Relative paths inside the file resolve against the file's own directory, so a config
can live next to the corpus and still work from any working directory. Keep the real
config out of version control: `.gitignore` already excludes `workbench.config.json`.

## `project`

| Key | Meaning |
| --- | --- |
| `name` | Full project name, printed under the page header |
| `short` | Short caption, used in the topbar crumb |
| `mark` | Two to four letters for the topbar glyph and the favicon-ish square |
| `site` | Site description line |
| `standpoint` | Whose books are being read, e.g. the main contractor |
| `currency` | ISO code or symbol printed on every money tile |

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
| `valueUsd` | | Secondary-currency sum, if the contract is measured in two currencies |
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
prints. Keeping them separate is what lets the same code serve a project whose series
are called `issued_ceb` and one whose series are called `issued_nga` — the label is
configuration, the key is only a join.

Every source is optional. A key that is missing or points at a folder that does not
exist yields an empty section rather than an error, so a workbench can be built
incrementally: start with letters, add payments later.

## Building

```bash
python tools/build_data.py                 # uses workbench.config.json
python tools/build_data.py my-project.json # or an explicit file
python tools/build_client.mjs              # only needed after editing src/client/*.js
```

The host half caches the parsed dataset by file size and mtime, so a rebuild is picked
up on the next request. Changes to `index.js` itself need the bundle toggled off and on
in the plugin manager.

## Regenerating the demo dataset

`data/` in this repository is synthetic — see `tools/make_demo.py`. Regenerate it with:

```bash
python tools/make_demo.py
```

That overwrites `data/workbench.json` and `data/index.json` with the invented project
described above. Do not commit a dataset built from a real project: it contains
contract sums, party names and correspondence subjects.
