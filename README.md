# EPC Project Workbench

A project-controls workbench for an EPC contract, delivered as a plugin for
[DeepSeek Harness](https://github.com/deepseek-ai). It reads the project records a
contractor already keeps — correspondence, minutes, the payment register, defect logs,
certificate workbooks, document folders — and renders them as one page: how much has
been certified, what is still unpaid, what was written, what is open, what was handed
over.

It is read from the **main contractor's** side of the contract: the contractor is paid
by the employer under the main contract, and pays its subcontractor under each package.
Every view can be switched to any of those contracts, and the numbers, charts, tables
and the statusbar follow the selection.

![Project overview](docs/img/overview.png)

The visual language follows [massing.build](https://massing.build/app/): one meaning per
colour, a left icon rail grouped into clusters, a compact topbar and statusbar, and
monospaced data columns. Dark and light themes, English and Chinese copy.

## What it shows

| View | Contents |
| --- | --- |
| **Overview** | Contract register strip; the money band for the selected contract (revised price with the original beside it, works certified against that cap, latest certificate, price adjustment); project KPIs; the latest certificate card with its closing statement; the contract participants; correspondence volume and payment-release charts; defect severity, discipline and package breakdowns |
| **Commercial** | Main-contract certificate register with the second-currency split and a share column; the escalation ledger; the bill-level summary of the latest certificate; the closing statement. Per-package: payment certificates, receipts from the employer, retention and advance recovery, and the certificate's bill-of-quantities detail |
| **Correspondence** | Every letter, filtered by contract, with document-code distribution, volume by month and most frequent subjects recomputed from the selected contract |
| **Meetings** | Minute books grouped by series, volume chart, filterable register |
| **Quality & Defects** | Defect register with status, overdue count, severity and priority mix, top locations, and a filterable table showing days remaining |
| **Documents** | Contract and insurance documents, taking-over certificates (issued vs draft), signed certificate scans indexed by reference, material submission packages, media counts, retention and advance balances |

Global search (`⌘K` / `Ctrl-K`) runs over the flat record index — one row per letter,
minute, defect, certificate and scanned certificate — and jumps to the owning view.

![Commercial](docs/img/commercial.png)

## Demo data

`data/` contains a **synthetic project** (`Northern Ring Substation Upgrade`) with 990
letters, 85 sets of minutes, 180 defects, 24 subcontract certificates and 14
main-contract certificates. It exists so the plugin renders something meaningful on
first install; no real project data is included, and `tools/make_demo.py` regenerates it
deterministically.

Point it at a real corpus by writing a configuration file — see
[docs/CONFIGURATION.md](docs/CONFIGURATION.md):

```bash
cp workbench.config.example.json workbench.config.json
# edit: parties, contracts, sources.root, folder names, sheet names
python tools/build_data.py
```

The extractor is tolerant by design: every source is optional, and a folder that is not
there produces an empty section rather than a failed build, so a workbench can start
with correspondence and grow into payments later.

## Installing as a Harness plugin

The package root is the plugin: `index.js` is the host half (it registers two read-only
JSON routes), `client.js` is the built client half, `cordis.patch.yml` mounts it into the
Web UI.

```bash
# from a checkout
dsh plugin add /path/to/EPC_Workbench      # or: plugin_manager install_bundle
```

`package.json` `files` lists only the runtime surface — host half, client bundle, icon,
patch, locales and the two dataset files. `src/`, `tools/` and `preview/` are development
aids and are not needed at runtime.

## Rebuilding

```bash
python tools/build_data.py        # corpus  -> data/workbench.json + data/index.json
node   tools/build_client.mjs     # src/client/*.js -> client.js
node   --check client.js
node   tools/smoke.mjs            # headless render of every view and forced state
node   tools/check_i18n.mjs       # EN/ZH key coverage
node   tools/preview.mjs overview # static HTML for screenshot review (dev only)
```

`src/client/*.js` are concatenated in filename order into one module, so a helper
defined in `src/client/35_scope.js` is visible to every later fragment. That is why the
fragments are numbered and why functions are declared rather than imported.

The host half caches the parsed dataset by file size and modification time, so a rebuild
of the data is picked up on the next request. Changes to `index.js` itself need the
bundle toggled off and on again in the plugin manager.

## How the data is shaped

`tools/build_data.py` writes two files:

- `data/workbench.json` — the aggregated dataset: project identity, taxonomy, contracts,
  letters, meetings, defects, payments, retention, the latest certificate, the
  main-contract certificate series and the document counts.
- `data/index.json` — a flat array of `[kind, reference, date, text, tag, file]` rows for
  search, where `kind` is `L` letter, `M` minutes, `D` defect, `I` subcontract
  certificate, `C` main-contract certificate or `S` scanned certificate.

The client never hardcodes a project's vocabulary. Series keys, contract ids, party names
and contract numbers all arrive inside the payload (`taxonomy`), which is why the same
bundle serves any project: `contractLabel(data, id)` and `seriesLabel(data, key)` look
those names up rather than printing a literal.

## Layout

```
index.js                  host half — two read-only JSON routes, mtime-keyed cache
client.js                 client half — built artifact
src/client/*.js           client sources, concatenated in filename order
  00_head.js              module wrapper
  10_css.js               the whole stylesheet
  20_lib.js               formatting, charts, small primitives
  30_i18n.js              EN and ZH copy
  35_scope.js             contract register, scope resolution, shared money helpers
  40_overview.js          50_commercial.js  60_correspondence.js
  70_quality.js           80_shell.js
data/workbench.json       aggregated dataset
data/index.json           flat search index
tools/build_data.py       corpus -> data files, config-driven
tools/epc_config.py       configuration loading and validation
tools/make_demo.py        synthetic dataset generator
tools/build_client.mjs    concatenation + wrap
tools/smoke.mjs           headless render test
tools/check_i18n.mjs      locale coverage audit
tools/preview.mjs         static preview pages
docs/CONFIGURATION.md     every configuration key
```

## Privacy

The plugin ships no project data: the committed dataset is generated by
`tools/make_demo.py` and every name in it is invented. A dataset built from a real
corpus contains contract sums, party names and correspondence subjects — keep
`workbench.config.json` and any real `data/` out of version control. `.gitignore`
already excludes the former, and `preview/` output.

## Licence

MIT — see [LICENSE](LICENSE).
