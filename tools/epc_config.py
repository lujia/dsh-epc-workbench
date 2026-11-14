# -*- coding: utf-8 -*-
"""Project configuration for the EPC workbench extractor.

Nothing about a particular project lives in the extractor itself: the parties,
the contract numbers, the letter and meeting series and the folder layout are
all read from a JSON configuration file, so the same code builds a workbench for
any EPC package laid out the documented way.

The file is looked up in this order:

  1. the path given as the first command-line argument
  2. the WORKBENCH_CONFIG environment variable
  3. workbench.config.json next to the package root
  4. workbench.config.example.json next to the package root

See docs/CONFIGURATION.md for the schema, and workbench.config.example.json for
a complete worked example.
"""
import datetime
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)

DEFAULT_NAMES = ("workbench.config.json", "workbench.config.example.json")

CONTRACT_KINDS = ("main", "sub")


class ConfigError(Exception):
    """A configuration file that cannot be used as given."""


def _pkg_path(*parts):
    return os.path.join(PKG, *parts)


def locate(argv=None):
    """Return the configuration path to use, or None when there is not one."""
    argv = list(argv if argv is not None else [])
    for a in argv[1:]:
        if a.lower().endswith(".json") and not a.startswith("-"):
            return os.path.abspath(a)
    env = os.environ.get("WORKBENCH_CONFIG")
    if env:
        return os.path.abspath(env)
    for name in DEFAULT_NAMES:
        p = _pkg_path(name)
        if os.path.isfile(p):
            return p
    return None


def load(path=None):
    """Load and normalise a configuration dictionary.

    Every value the extractor reads goes through this function, so a missing
    optional field is filled with a neutral default rather than crashing a long
    extraction run halfway through.
    """
    path = path or locate()
    if not path:
        raise ConfigError(
            "no configuration found — copy workbench.config.example.json to "
            "workbench.config.json and point sources.root at your corpus")
    if not os.path.isfile(path):
        raise ConfigError("configuration not found: %s" % path)
    with open(path, encoding="utf-8") as fh:
        raw = json.load(fh)
    cfg = normalise(raw)
    cfg["_path"] = path
    cfg["_dir"] = os.path.dirname(path)
    return cfg


def normalise(raw):
    """Fill defaults and check the invariants the extractor relies on."""
    if not isinstance(raw, dict):
        raise ConfigError("configuration must be a JSON object")

    project = dict(raw.get("project") or {})
    project.setdefault("name", "EPC project")
    project.setdefault("short", project["name"])
    project.setdefault("mark", "EPC")
    project.setdefault("site", "")
    project.setdefault("standpoint", "")
    project.setdefault("currency", "")
    # The currencies the project is priced in. A contract can be certified in
    # more than one, and the slices add up to the price rather than convert into
    # each other, so both names have to travel with the data instead of being
    # assumed from the primary one alone.
    # The list belongs to the project — that is where the documentation puts it —
    # but a top-level list is accepted too so a hand-written file cannot silently
    # lose the second currency.
    declared = project.get("currencies") or raw.get("currencies") or []
    currencies = []
    for i, c in enumerate(declared):
        if isinstance(c, str):
            c = {"code": c}
        code = (c.get("code") or "").upper()
        if not code:
            raise ConfigError("currencies[%d] has no code" % i)
        currencies.append({
            "code": code,
            "label": c.get("label") or code,
            "key": c.get("key") or (code[:1].upper() + code[1:].lower()),
            "primary": bool(c.get("primary")) if "primary" in c else i == 0,
        })
    if not currencies and project["currency"]:
        code = project["currency"].upper()
        currencies.append({"code": code, "label": code,
                           "key": code[:1].upper() + code[1:].lower(), "primary": True})
    if currencies and not any(c["primary"] for c in currencies):
        currencies[0]["primary"] = True
    project["currencies"] = currencies

    parties = []
    for i, p in enumerate(raw.get("parties") or []):
        if "id" not in p:
            raise ConfigError("parties[%d] has no id" % i)
        parties.append({
            "id": p["id"],
            "name": p.get("name") or p["id"],
            "former": p.get("former") or "",
            "abbr": p.get("abbr") or "",
            "role": p.get("role") or p["id"],
        })
    if not parties:
        parties = [
            {"id": "employer", "name": "Employer", "former": "", "abbr": "", "role": "employer"},
            {"id": "contractor", "name": "Contractor", "former": "", "abbr": "", "role": "contractor"},
            {"id": "subcontractor", "name": "Subcontractor", "former": "", "abbr": "", "role": "subcontractor"},
        ]
    party_ids = {p["id"] for p in parties}

    contracts = []
    for i, c in enumerate(raw.get("contracts") or []):
        if "id" not in c:
            raise ConfigError("contracts[%d] has no id" % i)
        kind = c.get("kind") or "sub"
        if kind not in CONTRACT_KINDS:
            raise ConfigError("contracts[%d].kind must be one of %s" % (i, CONTRACT_KINDS))
        counterparty = c.get("counterparty") or ("employer" if kind == "main" else "subcontractor")
        if counterparty not in party_ids:
            raise ConfigError("contracts[%d].counterparty %r is not a party id" % (i, counterparty))
        contracts.append({
            "id": c["id"],
            "kind": kind,
            "no": c.get("no") or c["id"],
            "label": c.get("label") or c["id"],
            # 'tag' is the token a document reference carries for this contract
            # ('…-P01-…'), which is how a letter is attributed to a package.
            "tag": c.get("tag") or c["id"],
            "counterparty": counterparty,
            "currency": c.get("currency") or project["currency"],
            "value": c.get("value"),
            "valueUsd": c.get("valueUsd"),
            "valueRevised": c.get("valueRevised"),
            "originalValue": c.get("originalValue"),
            "originalValueUsd": c.get("originalValueUsd"),
            "advancePct": c.get("advancePct"),
            "retentionPct": c.get("retentionPct"),
            "issuer": c.get("issuer") or "contractor",
            "dir": c.get("dir") or "",
            "file": c.get("file") or "",
            "has_period": bool(c.get("has_period", True)),
        })
    if not contracts:
        contracts = [{"id": "MAIN", "kind": "main", "no": "MAIN", "label": "Main contract",
                      "counterparty": parties[0]["id"], "currency": project["currency"],
                      "value": None, "issuer": "contractor", "dir": "", "file": "",
                      "has_period": True}]
    contract_ids = [c["id"] for c in contracts]
    main = next((c for c in contracts if c["kind"] == "main"), contracts[0])
    subs = [c for c in contracts if c["kind"] == "sub"]

    sources = dict(raw.get("sources") or {})
    sources.setdefault("root", "")
    sources.setdefault("defects", "")
    sources.setdefault("paymentsRegister", "")
    sources.setdefault("mainContractDir", "")
    sources.setdefault("mainContractSums", [])
    sources.setdefault("scanPattern", "")

    # The letter and minute series live under `sources` in a hand-written config,
    # while discovery returns them at the top level because they are the first thing
    # a reader looks for. Both spellings are accepted so a discovered config and a
    # typed one describe the same thing.
    letter_src = sources.get("letters") or raw.get("letters") or []
    meeting_src = sources.get("meetings") or raw.get("meetings") or []

    letters = []
    for i, s in enumerate(letter_src):
        if not s.get("dir"):
            raise ConfigError("sources.letters[%d] has no dir" % i)
        letters.append({
            "dir": s["dir"],
            "series": s.get("series") or s["dir"],
            "contract": s.get("contract") or main["id"],
            "side": s.get("side") or "issued",
            "label": s.get("label") or s["dir"],
        })
    for s in letters:
        if s["contract"] not in contract_ids:
            raise ConfigError("sources.letters entry %r names unknown contract %r"
                              % (s["dir"], s["contract"]))

    meetings = []
    for i, s in enumerate(meeting_src):
        if not s.get("dir"):
            raise ConfigError("sources.meetings[%d] has no dir" % i)
        meetings.append({
            "dir": s["dir"],
            "series": s.get("series") or s["dir"],
            "contract": s.get("contract") or main["id"],
            "label": s.get("label") or s["dir"],
        })
    for s in meetings:
        if s["contract"] not in contract_ids:
            raise ConfigError("sources.meetings entry %r names unknown contract %r"
                              % (s["dir"], s["contract"]))

    sheets = dict(sources.get("sheets") or {})
    sheets.setdefault("ipc", "")
    sheets.setdefault("employer", "")
    sheets.setdefault("monthly", "")
    sources["sheets"] = sheets

    latest = dict(sources.get("latestCertificate") or {})
    latest.setdefault("dir", "")
    latest.setdefault("file", "")
    latest.setdefault("sheet", "")
    sources["latestCertificate"] = latest

    docs = dict(sources.get("docs") or {})
    for k, v in (("contracts", ""), ("toc", ""), ("materials", ""),
                 ("photos", ""), ("videos", ""), ("pdfLetters", "")):
        docs.setdefault(k, v)
    sources["docs"] = docs

    return {
        "project": project,
        "parties": parties,
        "contracts": contracts,
        "sources": sources,
        "letters": letters,
        "meetings": meetings,
        "main": main,
        "subs": subs,
    }


# --------------------------------------------------------------------------- lookups
def party(cfg, pid):
    for p in cfg["parties"]:
        if p["id"] == pid:
            return p
    return {"id": pid, "name": pid, "former": "", "abbr": "", "role": pid}


def party_role(cfg, pid):
    return party(cfg, pid)["role"]


def contract(cfg, cid):
    for c in cfg["contracts"]:
        if c["id"] == cid:
            return c
    return None


def subsystem(cfg):
    """The subcontract a package-level source belongs to, by folder name."""
    for c in cfg["subs"]:
        if c["dir"] and c["dir"] in (c.get("no") or ""):
            return c
    return cfg["subs"][0] if cfg["subs"] else cfg["main"]


def root_of(cfg):
    """Absolute corpus root; relative roots resolve against the config file."""
    root = cfg["sources"]["root"]
    if not root:
        return ""
    if os.path.isabs(root):
        return root
    base = cfg.get("_dir") or PKG
    return os.path.abspath(os.path.join(base, root))


def out_of(cfg):
    out = cfg["sources"].get("out") or "data"
    if os.path.isabs(out):
        return out
    return os.path.abspath(os.path.join(cfg.get("_dir") or PKG, out))


def party_short(cfg, pid):
    p = party(cfg, pid)
    return p["abbr"] or p["name"]


# --------------------------------------------------------------------------- discovery
LETTER_DIR_RE = re.compile(r"letters?", re.I)
MOM_DIR_RE = re.compile(r"meeting|minutes?|mom", re.I)
DEFECT_DIR_RE = re.compile(r"defect|snag|dl", re.I)
PACKAGE_DIR_RE = re.compile(r"(?:^|[^a-z])(?:p|package|ipc[~_-]?)(\d{1,2})", re.I)
HEADER_LINE_RE = re.compile(r"^\[(\w+)\]\s*(.*)$")
CURRENCY_LABEL_RE = re.compile(r"\((?P<code>[A-Z$]{2,4})\)")
CURRENCY_CODE_MAP = {"US$": "USD", "USD": "USD", "LKR": "LKR", "SLR": "LKR", "JPY": "JPY",
                     "EUR": "EUR", "RMB": "CNY", "CNY": "CNY", "GBP": "GBP"}
PACKAGE_TOKEN_RE = re.compile(r"-(P\d{1,2})-", re.I)
PRICE_NO_RE = re.compile(r"Contract\s*NO\.?\s*:?\s*([A-Z0-9][A-Z0-9/._-]{4,})", re.I)
# 'US$15,149,404.61+  2,060,542,142.63' — the label is optional and belongs to the
# figure that follows it, so both slices are read in one pass in their own order.
AMOUNT_RE = re.compile(r"(US\$|LKR|SLR|USD|EUR|JPY|CNY|GBP|RMB)?\s*([\d][\d,]*\.\d{2})")
# A registered company name, as it appears on a letterhead: 'Electricity Generation
# Lanka (Pvt) Ltd'. The company suffix is what anchors it; the text before it is
# whatever the letterhead happens to print.
ORG_RE = re.compile(r"([A-Z][A-Za-z&.,()'\- ]{5,70}?(?:\(Pvt\)\s*Ltd|Ltd|Limited"
                    r"|Corporation|Authority|Board|Company|Agency|Ministry))")
# The date printed on a letterhead, in either order the two offices use:
# 'Date: 25th Sep 2026', 'Date: June 10, 2026'. The day carries OCR noise on the
# scans ('25TM', '25"', '23'), so anything short and non-numeric may follow it.
_MONTH_ALT = (r"(January|February|March|April|May|June|July|August|September|October"
              r"|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)")
LETTER_DATE_DMY = re.compile(
    r"(\d{1,2})\s*[^0-9A-Za-z]{0,3}\s*[./ -]?\s*" + _MONTH_ALT + r"[.,]?\s*[./ -]?\s*(\d{4})",
    re.I)
LETTER_DATE_MDY = re.compile(
    _MONTH_ALT + r"[.,]?\s*(\d{1,2})\s*[^0-9A-Za-z]{0,3}\s*[./, -]?\s*(\d{4})", re.I)
MONTH_NUM = {m[:3].lower(): i + 1 for i, m in enumerate(
    ("january", "february", "march", "april", "may", "june", "july",
     "august", "september", "october", "november", "december"))}


def _md_files(folder):
    try:
        return [n for n in sorted(os.listdir(folder)) if n.lower().endswith(".md")]
    except OSError:
        return []


def _xlsx_files(folder):
    try:
        return [n for n in sorted(os.listdir(folder))
                if n.lower().endswith(".xlsx") and not n.lower().startswith("~$")]
    except OSError:
        return []


def _subdirs(folder):
    try:
        return [n for n in sorted(os.listdir(folder))
                if not n.startswith(".") and os.path.isdir(os.path.join(folder, n))]
    except OSError:
        return []


def _letter_head(path, limit=14):
    """The ``[Key] value`` lines at the top of an extracted letter."""
    out = {}
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            head = fh.read(4000)
    except OSError:
        return out
    for line in head.splitlines()[:limit]:
        m = HEADER_LINE_RE.match(line)
        if m:
            out[m.group(1)] = m.group(2).strip()
        elif out and not line.strip():
            break
    return out


def _ref_tokens(name):
    """Upper-case reference tokens at the head of a document name.

    'CMEC-ADVE-CYE-P01-C-001__01.md' yields CMEC, ADVE, CYE, P01, C. Only the
    first few are names of organisations — the rest is a document code — so the
    caller decides which tokens are parties by matching them across series.
    """
    head = name.split("__")[0]
    parts = re.split(r"[-_\s]", head)
    out = []
    for p in parts:
        if re.fullmatch(r"[A-Z]{2,6}", p):
            out.append(p)
        else:
            break
    return out


def _package_of_ref(name):
    m = PACKAGE_TOKEN_RE.search(name)
    return ("P" + m.group(1)[1:].zfill(2)) if m else ""


def _plausible_org(name):
    """Whether a matched run of capitals is a company name rather than prose.

    The pattern that finds a registered name ends at the company suffix, so any
    sentence that happens to finish with 'Board' or 'Company' also matches:
    'Change of Name from Ceylon Electricity Board' and 'Request for Approval of
    the Third-Party Gantry Crane Testing Company' both do. A real name does not
    carry the small joining words that sentences need.
    """
    low = " " + name.lower() + " "
    if any(w in low for w in (" from ", " with ", " to ", " for ", " our ", " your ")):
        return False
    if len(name.split()) > 7:
        return False
    first = name.split()[0].lower().strip(".,")
    if first in ("request", "director", "main", "change", "ref", "date", "subject",
                 "attention", "the", "dear", "gentlemen", "sir"):
        return False
    return True


def _letter_date(path):
    """The date printed near the top of an extracted letter, as (y, m, d).

    Returned as a tuple so letters can be ordered without a date library. (0, 0, 0)
    when the page carries no readable date, which sorts them oldest — a letter
    whose date the OCR lost is no evidence about which name is current. Both
    word orders are tried, and the earliest match in the page wins, because the
    date of the letter is printed in the heading while later dates belong to the
    references the letter quotes.
    """
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            text = fh.read(3000)
    except OSError:
        return (0, 0, 0)
    best = None
    for rx, order in ((LETTER_DATE_DMY, "dmy"), (LETTER_DATE_MDY, "mdy")):
        for m in rx.finditer(text):
            if order == "dmy":
                day, mon, year = m.group(1), m.group(2), m.group(3)
            else:
                mon, day, year = m.group(1), m.group(2), m.group(3)
            num = MONTH_NUM.get(mon.lower()[:3])
            if not num or not (1 <= int(day) <= 31) or not (1900 < int(year) < 2200):
                continue
            if best is None or m.start() < best[0]:
                best = (m.start(), (int(year), num, int(day)))
    return best[1] if best else (0, 0, 0)


def _org_names(folder, rel, sender="", newest=True, sample=40):
    """Registered organisation names printed on the letters of one series.

    The letterhead is the only place a full legal name appears, and a party that
    is renamed keeps printing the new name from that point on, so the letters near
    the end of the correspondence state the name in use while the earliest ones
    still carry the name it replaced. Both lists are returned so the caller can
    print the current name and keep the previous one beside it.

    Two details make this reliable on real scans. The samples are ordered by the
    DATE PRINTED ON THE LETTER, because file names sort by document code and a low
    code number can belong to a letter written years later. And every registered
    name in the page is counted, not just the first: a scan whose letterhead is a
    logo puts the legal name in the footer or the address block instead, and the
    caller is the one that knows which of these names belong to somebody else.
    """
    full = os.path.join(folder, rel)
    names = _md_files(full)
    if not names:
        return []
    if sender:
        mine = [n for n in names
                if (_ref_tokens(n) or [""])[0].upper() == sender.upper()]
        # No letters from this party in this folder means the series does not
        # describe this party at all — reading everybody else's letterheads here
        # would hand the caller the operator's own name as somebody else's.
        if not mine:
            return []
        names = mine
    dated = [(n, _letter_date(os.path.join(full, n))) for n in names]
    # OCR puts stray years into a letter now and then ('2076' inside a phone
    # number), and one of those would outrank every real letter. The middle year
    # of the series says when the correspondence happened, so anything far outside
    # it is treated as undated rather than trusted.
    years = sorted(d[0] for _n, d in dated if d[0])
    if years:
        centre = years[len(years) // 2]
        dated = [(n, d if (d[0] and abs(d[0] - centre) <= 5) else (0, 0, 0))
                 for n, d in dated]
    dated.sort(key=lambda e: (e[1], e[0]), reverse=bool(newest))
    picked = [n for n, _ in dated[:sample]]
    counts = {}
    for n in picked:
        try:
            with open(os.path.join(full, n), encoding="utf-8", errors="replace") as fh:
                text = fh.read(4000)
        except OSError:
            continue
        for m in ORG_RE.finditer(text):
            name = " ".join(m.group(1).split())
            if len(name) < 8 or not _plausible_org(name):
                continue
            counts[name] = counts.get(name, 0) + 1
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return [n for n, c in ranked if c >= 2][:5]


NAME_STOP = frozenset(("ltd", "limited", "pvt", "private", "company", "corporation",
                       "co", "the", "and", "of", "group", "plc", "inc"))


def _norm_name(name):
    return [w for w in re.sub(r"[^a-z0-9]+", " ", (name or "").lower()).split()
            if w not in NAME_STOP]


def _same_org(a, b):
    """Whether two printed names denote the same organisation.

    Comparing the whole string would treat 'Electricity Generation Lanka (Pvt) Ltd'
    and 'Ceylon Electricity Board' as unrelated, and treating every pair as
    unrelated would print the same company twice under two roles. Two shared
    distinctive words is the line: it keeps 'China Machinery Engineering
    Corporation (CMEC)' together with 'China Machinery Engineering Corporation'
    and keeps the two letterhead names of one renamed party apart.
    A short upper-case code such as 'CMEC' is matched against the initials of the
    printed name, company suffix included, because that is what the code abbreviates.
    """
    if not a or not b:
        return False
    wa, wb = _norm_name(a), _norm_name(b)
    if len(set(wa) & set(wb)) >= 2:
        return True
    long, short = (a, b) if len(wa) >= len(wb) else (b, a)
    code = re.sub(r"[^A-Za-z]", "", short)
    if 2 <= len(code) <= 6 and code.isupper():
        bare = re.sub(r"\([^)]*\)", " ", long)
        words = [w for w in re.findall(r"[A-Za-z]+", bare)
                 if w.lower() not in ("pvt", "private", "of", "and", "the")]
        initials = "".join(w[0] for w in words).upper()
        if initials.startswith(code):
            return True
        # Some codes abbreviate the first word rather than the initials — 'ADVE'
        # for 'Advantis', 'HAYL' for 'Hayleys' — so a shared opening is enough.
        if words and len(words[0]) >= 4:
            opening = words[0][:4].upper()
            if code[:4] == opening or opening.startswith(code[:3]):
                return True
    return False


def _open(path):
    try:
        from openpyxl import load_workbook
        return load_workbook(path, read_only=True, data_only=True)
    except Exception:
        return None


def _ms_header(path):
    """What the certificate workbook states about the project in words.

    The 'M-S' summary sheet carries the project name, the contract number, the
    employer and the contractor on its first rows, and it labels every money
    column with its currency — including a currency that has no bill rows of its
    own, which is why the labels are read from here rather than derived from the
    amounts.
    """
    out = {"project": "", "contract": "", "employer": "", "contractor": "",
           "currencies": [], "sheets": [], "sums": []}
    wb = _open(path)
    if wb is None:
        return out
    out["sheets"] = list(wb.sheetnames)
    ms = None
    for n in wb.sheetnames:
        if n.strip().lower() in ("m-s", "ms", "m & s", "m&s"):
            ms = wb[n]
            break
    if ms is not None:
        rows = []
        span = 14
        try:
            span = min(int(ms.max_row or 14), 400)
        except Exception:
            span = 14
        try:
            for row in ms.iter_rows(min_row=1, max_row=span, max_col=16, values_only=True):
                rows.append(list(row))
        except Exception:
            rows = []
        header_at = None
        for i, cells in enumerate(rows):
            for c in cells:
                if not isinstance(c, str):
                    continue
                low = c.lower()
                for key, prefix in (("project", "project:"), ("employer", "employer:"),
                                    ("contractor", "contractor:")):
                    if low.startswith(prefix) and not out[key]:
                        out[key] = c.split(":", 1)[1].strip()[:120]
                m = PRICE_NO_RE.search(c)
                if m and not out["contract"]:
                    out["contract"] = m.group(1).strip()
            # the currency row is the one whose cells are mostly '(XXX)' labels
            labels = [CURRENCY_LABEL_RE.search(c) for c in cells if isinstance(c, str)]
            if sum(1 for x in labels if x) >= 2:
                header_at = i
                break
        if header_at is not None:
            cells = rows[header_at]
            below = rows[header_at + 1:]
            for col, c in enumerate(cells):
                if not isinstance(c, str):
                    continue
                m = CURRENCY_LABEL_RE.search(c)
                if not m:
                    continue
                code = CURRENCY_CODE_MAP.get(m.group("code").upper())
                if not code:
                    continue
                # a currency label over a column that never holds a figure is a
                # column the project does not price in
                used = any(len(r) > col and isinstance(r[col], (int, float))
                           and not isinstance(r[col], bool) for r in below)
                if used and code not in out["currencies"]:
                    out["currencies"].append(code)
    wb.close()
    return out


def _price_sums(path):
    """The contract price stated above the payment register, per currency.

    The cell reads like 'Contract Price \\nUS$15,149,404.61+  2,060,542,142.63':
    the foreign slice carries a label and the local slice follows bare, because
    the sheet's own column headings already say which is which. Both are taken in
    the order they appear so each slice stays attached to its currency.
    """
    wb = _open(path)
    if wb is None:
        return []
    out = []
    for name in wb.sheetnames:
        if not re.search(r"monthly|record", name, re.I):
            continue
        ws = wb[name]
        try:
            rows = [list(r) for r in ws.iter_rows(max_row=8, max_col=8, values_only=True)]
        except Exception:
            rows = []
        for cells in rows:
            text = " ".join(c for c in cells if isinstance(c, str))
            if "price" not in text.lower():
                continue
            for m in AMOUNT_RE.finditer(text):
                try:
                    amount = round(float(m.group(2).replace(",", "")), 2)
                except ValueError:
                    continue
                # a bare figure under 1000 in a header cell is a year or a revision
                if amount < 1000:
                    continue
                out.append({"code": CURRENCY_CODE_MAP.get((m.group(1) or "").upper(), ""),
                            "amount": amount})
            if out:
                break
        if out:
            break
    wb.close()
    return out


def _sub_prices(path):
    """Subcontract prices stated above the payment register, in order."""
    wb = _open(path)
    if wb is None:
        return []
    out = []
    for name in wb.sheetnames:
        if not re.search(r"monthly|record", name, re.I):
            continue
        ws = wb[name]
        try:
            rows = [list(r) for r in ws.iter_rows(max_row=8, max_col=8, values_only=True)]
        except Exception:
            rows = []
        for cells in rows:
            for c in cells:
                if not isinstance(c, str) or "sub" not in c.lower() or "price" not in c.lower():
                    continue
                for m in re.finditer(r"([A-Z]?\d{2,4})\s*:\s*([\d,]+(?:\.\d+)?)", c):
                    try:
                        out.append({"code": m.group(1).upper(),
                                    "amount": float(m.group(2).replace(",", ""))})
                    except ValueError:
                        pass
                break
            if out:
                break
        if out:
            break
    wb.close()
    return out


def _sub_no(folder, docs_rel, code, index):
    """The executed subcontract number, read off the contract documents.

    The payment register states the package prices as 'C008: …' and 'C009: …', and
    those are only the tail of the number the documents actually carry. Each package
    has its own folder of executed documents, so the folder name and the documents
    inside it are the place to look; the register's short code is only a fallback.
    """
    if not docs_rel:
        return ""
    root = os.path.join(folder, docs_rel)
    want = ("c" + code[1:]) if code else ""
    candidates = _subdirs(root)
    chosen = None
    for d in candidates:
        low = d.lower()
        if want and want in low:
            chosen = d
            break
    if chosen is None:
        # the folders are named after the document series, so the ordinal of the
        # package within the register is the ordinal of the folder
        for d in candidates:
            if re.search(r"(?:^|\D)P0*%d\b" % (index + 1), d, re.I):
                chosen = d
                break
    if chosen is None and index < len(candidates) and len(candidates) == 1:
        chosen = candidates[index]
    if chosen is None:
        return ""
    full = os.path.join(root, chosen)
    found = {}
    for n in sorted(os.listdir(full)):
        if not n.lower().endswith(".md"):
            continue
        try:
            with open(os.path.join(full, n), encoding="utf-8", errors="replace") as fh:
                text = fh.read(6000)
        except OSError:
            continue
        for m in re.finditer(r"([A-Z][A-Z0-9]{2,}[-/][A-Z0-9][A-Z0-9/._-]{6,})", text):
            tok = m.group(1).rstrip(".")
            # the base number repeats; an addendum is the same number with a suffix
            base = re.match(r"^([A-Z][A-Z0-9]{2,}[-/][A-Z0-9][A-Z0-9/._-]*?-\d{4}"
                            r"[-/][A-Z]\d{3})\b", tok)
            if base:
                found[base.group(1)] = found.get(base.group(1), 0) + 1
    if not found:
        return ""
    return max(found.items(), key=lambda kv: kv[1])[0]


def _sheets_of(path):
    wb = _open(path)
    if wb is None:
        return []
    names = list(wb.sheetnames)
    wb.close()
    return names


def _pick_register(folder):
    """The workbook that holds the payment register, by its sheet names."""
    for name in _xlsx_files(folder):
        sheets = _sheets_of(os.path.join(folder, name))
        low = [s.lower() for s in sheets]
        if any("interim payment" in s for s in low) and any("monthly" in s for s in low):
            return name, sheets
    return "", []


def _direction(head):
    """('FROM', 'TO') from a letter's [Direction] line, upper-cased."""
    raw = (head.get("Direction") or "").strip()
    parts = re.split(r"\s*(?:->|→|=>|to)\s*", raw, maxsplit=1)
    if len(parts) != 2:
        return "", ""
    return parts[0].strip().upper(), parts[1].strip().upper()


def _cert_ordinal(name):
    """Certificate number from a package workbook name, or 0 when it has none.

    The workbooks are named both ways — `CMEC-ADVE-C008-IPC-52.xlsx` and
    `ADVE-IPC 9 -009.xlsx` — and the trailing number is sometimes the certificate
    and sometimes a package code, so only the `IPC<n>` form is trusted.
    """
    m = re.search(r"IPC[\s\-_]*0*(\d{1,3})(?![\d])", name, re.I)
    return int(m.group(1)) if m else 0


def _cert_sheet(path, sheets, ordinal):
    """The sheet holding the certificate summary for that certificate number.

    Several sheets start with `IPC-`, and only the bare one is the summary: the
    numbered variants are per-bill blocks (`IPC-008 (3)`) and the `SUM`-prefixed
    ones are the item breakdown. The number in the sheet name is the certificate,
    so `IPC-008 (52)` on a file named `…IPC-52` is the summary of certificate 52,
    while `IPC-008` alone is the last application filed under package code 008.
    """
    plain = [s for s in sheets if re.match(r"^\s*IPC[\s\-_]?\d+\s*$", s, re.I)]
    numbered = [s for s in sheets if re.match(r"^\s*IPC[\s\-_]?\d+\s*\(\s*\d+\s*\)\s*$", s, re.I)]
    for s in numbered:
        inner = re.search(r"\(\s*(\d+)\s*\)", s)
        if inner and ordinal and int(inner.group(1)) == ordinal:
            return s
    if plain:
        return plain[0]
    return numbered[0] if numbered else ""


def _item_sheet(path, sheets):
    """The sheet holding the bill-by-bill breakdown.

    It is the one that carries the four amount columns, which is what tells it
    apart from the per-bill summaries that share the `SUM` in their name.
    """
    wb = _open(path)
    if wb is None:
        return ""
    try:
        for n in sheets:
            if "SUM" not in n.upper():
                continue
            ws = wb[n]
            for row in ws.iter_rows(min_row=1, max_row=20, max_col=8, values_only=True):
                labels = " ".join(str(c).lower() for c in row if isinstance(c, str))
                if "boq amount" in labels and "cumulative" in labels:
                    return n
    finally:
        try:
            wb.close()
        except Exception:
            pass
    return ""


def discover(folder):
    """Derive a workbench configuration from a project folder.

    Only the shapes the extractor already documents are assumed: letters are
    markdown files with a ``[Key] value`` header, minutes are markdown files in a
    folder named after the meeting series, the payment register is a workbook
    holding an interim-payment sheet per side plus a monthly sheet, every package
    keeps its certificates and one retention sheet in a folder of its own, and the
    signed scans sit in a folder that is not a package.

    What could not be established is listed in ``notes`` rather than filled in
    with a plausible value: a workbench that shows a number nobody can source is
    worse than one that shows nothing where the records are silent.
    """
    folder = os.path.abspath(folder)
    if not os.path.isdir(folder):
        raise ConfigError("not a folder: %s" % folder)

    notes = []
    name = os.path.basename(folder.rstrip("\\/")) or "EPC project"
    sources = {"root": folder, "out": "", "defects": "", "paymentsRegister": "",
               "mainContractDir": "", "mainContractSums": [], "scanPattern": "",
               "sheets": {}, "latestCertificate": {}, "docs": {}}

    top = _subdirs(folder)

    # ---------------------------------------------------------------- letter series
    series = []
    for d in top:
        full = os.path.join(folder, d)
        md = _md_files(full)
        if not md or not LETTER_DIR_RE.search(d):
            continue
        if not re.search(r"issued|received|sent", d, re.I):
            continue
        head = _letter_head(os.path.join(full, md[0]))
        if not (head.get("LetterNo") or head.get("RefNo") or head.get("Subject")):
            continue
        ref = head.get("LetterNo") or head.get("RefNo") or md[0]
        toks = _ref_tokens(ref) or _ref_tokens(md[0])
        # the newest file matters as well as the oldest one: both parties rename
        # themselves during a long project, and the name on the latest letter is
        # the one the reader will recognise
        newer = _letter_head(os.path.join(full, md[-1]))
        ref_last = newer.get("LetterNo") or newer.get("RefNo") or md[-1]
        toks_last = _ref_tokens(ref_last) or _ref_tokens(md[-1]) or toks
        frm, to = _direction(head)
        side = "received" if re.search(r"received", d, re.I) else "issued"
        if re.search(r"received", (head.get("DocType") or ""), re.I):
            side = "received"
        pkg = _package_of_ref(ref) or _package_of_ref(md[0]) or _package_of_ref(md[-1])
        # Every reference reads SENDER-RECEIVER-…, so the party a series is
        # *about* is the other end from its direction: the receiver of an issued
        # series and the sender of a received one. Keying the series by the sender
        # instead would collapse both 'issued to' folders into one, because the same
        # office sends to the employer and to the subcontractor alike.
        if side == "issued":
            other_tok = toks[1] if len(toks) > 1 else (frm if frm and frm != (toks[0] if toks else "") else "")
        else:
            other_tok = toks[0] if toks else frm
        series.append({
            "dir": d,
            "side": side,
            "count": len(md),
            "pkg": pkg,
            "prefix": (toks[0] if toks else "").upper(),
            "prefix_last": (toks_last[0] if toks_last else "").upper(),
            "other": (other_tok or (frm if side == "received" else to)).upper(),
            "frm": frm,
            "to": to,
            "tokens": toks,
            "tokens_last": toks_last,
        })
    if not series:
        notes.append("no letter series were recognised (a folder named …letters… holding "
                     "markdown with a [LetterNo] header)")

    # ---------------------------------------------------------------- meeting series
    meeting_dirs = []
    for d in top:
        full = os.path.join(folder, d)
        if MOM_DIR_RE.search(d) and not LETTER_DIR_RE.search(d):
            inner = [x for x in _subdirs(full) if _md_files(os.path.join(full, x))]
            if inner:
                meeting_dirs += [os.path.join(d, x) for x in inner]
            elif _md_files(full):
                meeting_dirs.append(d)
        else:
            for x in _subdirs(full):
                if MOM_DIR_RE.search(x) and _md_files(os.path.join(full, x)):
                    meeting_dirs.append(os.path.join(d, x))
    if not meeting_dirs:
        notes.append("no minute books were recognised (a folder named …meeting/minutes… "
                     "holding markdown)")

    # ---------------------------------------------------------------- contracts
    ipc_dirs = [d for d in top if re.search(r"ipc|payment certif|certificate", d, re.I)]
    ipc_root = os.path.join(folder, ipc_dirs[0]) if ipc_dirs else folder
    package_dirs, main_dir = [], ""
    for d in _subdirs(ipc_root):
        full = os.path.join(ipc_root, d)
        xl = _xlsx_files(full)
        if not xl:
            continue
        if re.search(r"main.?contract|employer|owner|client", d, re.I):
            main_dir = os.path.join(os.path.basename(ipc_root), d)
        else:
            package_dirs.append(os.path.join(os.path.basename(ipc_root), d))
    if not package_dirs and _xlsx_files(ipc_root) and not main_dir:
        package_dirs = [""]
    if main_dir:
        sources["mainContractDir"] = main_dir.replace("\\", "/")

    # ---------------------------------------------------------------- register
    reg_name, reg_sheets = _pick_register(ipc_root)
    if not reg_name:
        reg_name, reg_sheets = _pick_register(folder)
    reg_rel = ""
    if reg_name:
        base = ipc_root if os.path.isfile(os.path.join(ipc_root, reg_name)) else folder
        reg_rel = os.path.relpath(os.path.join(base, reg_name), folder).replace("\\", "/")
        sources["paymentsRegister"] = reg_rel
        low = [(s, s.lower()) for s in reg_sheets]
        sheets = {}
        for want, pattern in (("ipc", r"\bto\b"), ("employer", r"\bfrom\b"),
                              ("monthly", r"monthly")):
            for original, l in low:
                if re.search(pattern, l):
                    sheets[want] = original
                    break
        sources["sheets"] = sheets
        notes.append("payment register: %s (sheets %s)"
                     % (reg_rel, ", ".join("%s=%s" % (k, v) for k, v in sheets.items()) or "none"))
    else:
        notes.append("no payment register workbook was found (a workbook holding an "
                     "'Interim Payment to …' and an 'Interim Payment from …' sheet)")

    # ---------------------------------------------------------------- defects
    for d in top:
        if not DEFECT_DIR_RE.search(d):
            continue
        full = os.path.join(folder, d)
        cands = [n for n in _xlsx_files(full) if not re.search(r"\.bak$", n, re.I)]
        if cands:
            sources["defects"] = (d + "/" + cands[0]).replace("\\", "/")
            break
    if not sources["defects"]:
        notes.append("no defect register workbook was found")

    # ---------------------------------------------------------------- documents
    docs = {}
    for d in top:
        low = d.lower()
        if re.search(r"^contract", low) and "contracts" not in docs:
            docs["contracts"] = d
        elif re.search(r"taking|handover|toc\b", low) and "toc" not in docs:
            docs["toc"] = d
        elif re.search(r"material", low) and "materials" not in docs:
            docs["materials"] = d
        elif re.search(r"photo|image", low) and "photos" not in docs:
            docs["photos"] = d
        elif re.search(r"video", low) and "videos" not in docs:
            docs["videos"] = d
        elif re.search(r"pdf.?letter", low) and "pdfLetters" not in docs:
            docs["pdfLetters"] = d
    sources["docs"] = docs

    # ---------------------------------------------------------------- certificate header
    ms = {}
    main_xlsx = _xlsx_files(os.path.join(folder, main_dir)) if main_dir else []
    if main_xlsx:
        def _ipa_no(name):
            m = re.search(r"IPA[\s\-_]*(\d+)", name, re.I)
            return int(m.group(1)) if m else 0

        ranked = sorted(main_xlsx, key=_ipa_no, reverse=True)
        # the newest certificate states the project and the parties; the older ones
        # are kept as the fallback because the earliest workbooks predate the summary
        # sheet the wording lives on
        for n in ranked[:6]:
            head = _ms_header(os.path.join(folder, main_dir, n))
            if head.get("project") or head.get("employer"):
                ms = head
                break
        if not ms:
            ms = _ms_header(os.path.join(folder, main_dir, ranked[0]))
        if ms.get("currencies"):
            notes.append("currencies named by the certificate header: %s"
                         % ", ".join(ms["currencies"]))
        if ms.get("contract"):
            notes.append("main contract number: %s" % ms["contract"])
        # era sums: a certificate states the contract sum in force when it was signed,
        # and the extractor needs each of them to find the totals row of that era
        sums = []
        for n in ([ranked[0], ranked[-1]] + ranked[1:3]):
            wb = _open(os.path.join(folder, main_dir, n))
            if wb is None:
                continue
            ws = None
            for s in wb.sheetnames:
                if "application" in s.lower():
                    ws = wb[s]
                    break
            if ws is not None:
                try:
                    for row in ws.iter_rows(min_row=1, max_row=220, max_col=8, values_only=True):
                        cells = list(row)
                        if len(cells) < 3:
                            continue
                        label = " ".join(str(c) for c in cells[:2] if c is not None).lower()
                        if not ("contract price sum" in label or "awarded price" in label):
                            continue
                        v = cells[2]
                        if isinstance(v, bool) or not isinstance(v, (int, float)):
                            continue
                        if abs(v) < 10000:
                            continue
                        value = round(float(v), 2)
                        if not any(abs(value - x) < 1.0 for x in sums):
                            sums.append(value)
                except Exception:
                    pass
            wb.close()
        sources["mainContractSums"] = sums[:6]
        if sums:
            notes.append("contract sums the certificates state: %s" % sums[:6])
    else:
        notes.append("no main-contract certificates were found")

    # ---------------------------------------------------------------- scan pattern
    pdfs = []
    for base_dir in ([main_dir] if main_dir else []) + package_dirs:
        full = os.path.join(folder, base_dir) if base_dir else folder
        try:
            pdfs += [n for n in os.listdir(full) if n.lower().endswith(".pdf")]
        except OSError:
            continue
    for n in pdfs:
        if re.match(r"^[A-Z]+-(?:[A-Z0-9]+-)+P-\d+", n):
            sources["scanPattern"] = r"^(?P<party>[A-Z]+)(?:-[A-Z0-9]+)*?-P-0*(?P<ref>\\d+)\\b"
            break

    # ---------------------------------------------------------------- parties
    # Who is who comes from the reference prefixes, not from the [Direction] lines:
    # the organisation names in a reference survive a rename of the letterhead, so
    # every reference is `SENDER-RECEIVER-…` and the sender of an issued series is
    # the organisation running the workbench. Taking the far end of a received
    # series instead would make the counterparty look like the operator.
    def _pair(s, last=False):
        toks = s["tokens_last"] if last else s["tokens"]
        return (toks[0].upper() if toks else ""), (toks[1].upper() if len(toks) > 1 else "")

    sent, recv = {}, {}
    for s in series:
        frm, to = _pair(s)
        frm_last, to_last = _pair(s, True)
        if not frm:
            continue
        # an issued series is written from us outward, a received one the other way
        # round, so the operator sits at index 0 or 1 depending on the direction
        me, other = (frm, to) if s["side"] == "issued" else (to, frm)
        me_last, other_last = ((frm_last, to_last) if s["side"] == "issued"
                               else (to_last, frm_last))
        if me:
            sent[me] = sent.get(me, 0) + s["count"]
        if me_last:
            sent[me_last] = sent.get(me_last, 0) + s["count"]
        bucket = recv if s["side"] == "issued" else sent
        for tok in (other, other_last):
            if tok:
                bucket[tok] = bucket.get(tok, 0) + s["count"]

    ours = ""
    if sent:
        # the operator is whichever token appears as the sender in the most series
        # across both directions — a counterparty only ever sends one way
        scores = {}
        for s in series:
            frm, to = _pair(s)
            frm_last, to_last = _pair(s, True)
            me = frm if s["side"] == "issued" else to
            me_last = frm_last if s["side"] == "issued" else to_last
            for tok in (me, me_last):
                if tok:
                    scores[tok] = scores.get(tok, 0) + 1
        ours = max(scores.items(), key=lambda kv: kv[1])[0] if scores else ""
    if not ours:
        ours = max(sent.items(), key=lambda kv: kv[1])[0] if sent else ""

    def _counter(s):
        """The other end of one series, oldest and newest name."""
        frm, to = _pair(s)
        frm_last, to_last = _pair(s, True)
        first = to if s["side"] == "issued" else frm
        last = to_last if s["side"] == "issued" else frm_last
        return (first or last or ""), (last or first or "")

    main_side, sub_side = [], []
    for s in series:
        first, last = _counter(s)
        if not first and not last:
            continue
        if first == ours and last == ours:
            continue
        (main_side if not s["pkg"] else sub_side).append((first, last, s["count"]))

    def _best(rows):
        """The counterparty of a side, with the name it used before it was renamed."""
        if not rows:
            return "", ""
        agg = {}
        for first, last, n in rows:
            for tok, weight in ((first, n), (last, n)):
                if tok and tok != ours:
                    agg[tok] = agg.get(tok, 0) + weight
        if not agg:
            return "", ""
        # The newest token wins the identity and the older one becomes the former
        # name it is printed beside. Frequency is the wrong test here: a party that
        # was renamed wrote most of its letters under the OLD name simply because
        # the old name covered more of the project, so counting would keep the name
        # that is no longer in use.
        firsts = {}
        for first, last, n in rows:
            if last and last != ours:
                firsts.setdefault(last, 0)
                firsts[last] += n
                if first and first != last and first != ours:
                    firsts.setdefault(first, 0)
        order = []
        for first, last, n in rows:
            if last and last != ours and last not in order:
                order.append(last)
        best = order[-1] if order else max(agg.items(), key=lambda kv: kv[1])[0]
        older = [t for t in order if t != best] or [t for t in agg if t != best]
        former = older[0] if older else ""
        return best, former
    employer_tok, employer_former = _best(main_side)
    sub_tok, sub_former = _best(sub_side)

    # The reference prefix is a short code, never a legal name, so the full name is
    # read off the letterheads of the series that belong to each side. The newest
    # letters state the name in use; the oldest ones still show the name it replaced.
    def _series_of(side_tok, want_pkg):
        out = []
        for s in series:
            first, last = _counter(s)
            if side_tok and side_tok not in (first, last):
                continue
            if want_pkg is None:
                if s["pkg"]:
                    continue
            elif want_pkg is True:
                if not s["pkg"]:
                    continue
            out.append(s)
        return out

    def _name_for(side_tok, want_pkg):
        rows = _series_of(side_tok, want_pkg)
        now, then = [], []
        for s in sorted(rows, key=lambda x: -x["count"])[:3]:
            now += _org_names(folder, s["dir"], sender=side_tok, newest=True)
            then += _org_names(folder, s["dir"], sender=side_tok, newest=False)
        if not now:
            return "", ""
        # A letterhead almost always names the operator and sometimes the other
        # counterparty as well, so those names are mentions rather than this side's
        # own identity. This side's own code is never on that list: it is exactly
        # what the printed name is expected to match.
        skip = [ours, (employer_tok if side_tok != employer_tok else sub_tok)]
        current = next((n for n in now if not any(
            _same_org(n, x) for x in skip if x)), "")
        if not current:
            return "", ""
        old = next((n for n in then if n and n != current
                    and not _same_org(n, current)
                    and not any(_same_org(n, x) for x in skip if x)
                    and n.lower() not in current.lower()), "")
        return current, old

    emp_name, emp_old = _name_for(employer_tok, None)
    sub_name, sub_old = _name_for(sub_tok, True)

    def _pick(*candidates):
        """The printed name to show, plus the earlier one to keep beside it.

        The order of the arguments is the order of freshness, so the caller puts the
        name from the latest correspondence first and the name printed on the
        certificates after it. That matters where a certificate series was never
        reissued under the new name: the M-S header of the newest certificate still
        says 'Ceylon Electricity Board' months after the employer became
        Electricity Generation Lanka, so the workbook must not win by being official.

        A reference code such as 'ADVE' is only a fallback: it is what the documents
        use in their titles, but a reader needs the registered name, so a printed
        name always wins when one exists and a code never takes the place of a
        former name that is actually printed.
        """
        def printed(name):
            return bool(re.search(r"(?i)ltd|limited|corporation|authority|board"
                                  r"|company|agency|ministry|plc", name or ""))

        # Registered names and reference codes are collected apart: a code such as
        # 'ADVE' abbreviates a name that may also be in this list ('Advantis …'), and
        # testing the two against each other would throw the printed name away as a
        # duplicate of its own abbreviation.
        names, codes = [], []
        for c in candidates:
            c = " ".join((c or "").split())
            if not c:
                continue
            bucket = names if printed(c) else codes
            if any(c.lower() == x.lower() or _same_org(c, x) for x in bucket):
                continue
            bucket.append(c)
        order = names + [c for c in codes if not any(_same_org(c, p) for p in names)]
        if not order:
            return "", ""
        current = order[0]
        old = next((n for n in order[1:] if not _same_org(n, current)
                    and (printed(n) or not printed(current))), "")
        return current, old

    employer_name, employer_old = _pick(emp_name, ms.get("employer"), emp_old, employer_tok)
    contractor_name, contractor_old = _pick(ms.get("contractor"), ours)
    sub_full, sub_former = _pick(sub_name, sub_tok, sub_old)
    parties = [
        {"id": "employer", "name": employer_name or "Employer",
         "former": employer_old, "abbr": employer_tok, "role": "employer"},
        {"id": "contractor", "name": contractor_name or "Contractor",
         "former": contractor_old, "abbr": ours, "role": "contractor"},
        {"id": "subcontractor", "name": sub_full or "Subcontractor",
         "former": sub_former, "abbr": sub_tok, "role": "subcontractor"},
    ]

    # ---------------------------------------------------------------- contracts
    contracts = []
    main_amounts = _price_sums(os.path.join(folder, reg_rel)) if reg_rel else []
    usd = next((x["amount"] for x in main_amounts if x["code"] == "USD"), None)
    local = next((x["amount"] for x in main_amounts if x["code"] and x["code"] != "USD"), None)
    if local is None:
        # the local slice is printed bare after the labelled one, so it is the
        # figure left without a currency of its own
        local = next((x["amount"] for x in main_amounts if not x["code"]), None)
    if local is None and not main_amounts:
        notes.append("the contract price was not stated above the payment register")
    main_contract = {
        "id": "MAIN", "kind": "main", "team": "",
        "no": ms.get("contract") or "Main contract",
        "label": "Main contract",
        "counterparty": "employer",
        "issuer": "contractor",
        "currency": (ms.get("currencies") or [""])[0],
        "value": local, "valueUsd": usd, "valueRevised": local,
        "originalValue": None, "originalValueUsd": None,
    }
    contracts.append(main_contract)
    sub_prices = _sub_prices(os.path.join(folder, reg_rel)) if reg_rel else []
    for i, rel in enumerate(package_dirs):
        full = os.path.join(folder, rel) if rel else ipc_root
        code = ""
        m = PACKAGE_DIR_RE.search(os.path.basename(rel) or os.path.basename(full))
        if m:
            code = "P" + m.group(1).zfill(2)
        code = code or ("P" + str(i + 1).zfill(2))
        retention, has_period = "", True
        for n in _xlsx_files(full):
            if re.search(r"retention|advance", n, re.I):
                retention = n
                break
        if retention:
            wb = _open(os.path.join(full, retention))
            if wb is not None:
                ws = wb[wb.sheetnames[0]]
                joined = ""
                try:
                    for r in ws.iter_rows(max_row=3, max_col=8, values_only=True):
                        joined += " " + " ".join(str(c) for c in r if c is not None)
                except Exception:
                    pass
                wb.close()
                # a sheet with no period column is normal, not a fault: the rows
                # simply start at the certificate reference
                has_period = "period" in joined.lower()
        value = None
        if i < len(sub_prices):
            value = sub_prices[i]["amount"]
        # The subcontract number is not in the register's summary cell, which only
        # says 'C008: 486,031,428.00'. The executed contract documents name it in
        # full, and they sit in a folder per package, so that is where it is read.
        sub_no = _sub_no(folder, (docs or {}).get("contracts"), code, i)
        contracts.append({
            "id": code, "kind": "sub", "tag": code,
            "no": sub_no or code, "label": "Package %d" % (i + 1),
            "counterparty": "subcontractor", "issuer": "contractor",
            "currency": (ms.get("currencies") or [""])[0],
            "dir": rel.replace("\\", "/") if rel else "",
            "file": retention,
            "has_period": has_period,
            "value": value,
        })
    if not package_dirs:
        notes.append("no package certificate folders were found")

    # ---------------------------------------------------------------- latest certificate
    if package_dirs:
        first = os.path.join(folder, package_dirs[0])
        best, best_no = "", -1
        for n in _xlsx_files(first):
            if re.search(r"retention|advance", n, re.I):
                continue
            path = os.path.join(first, n)
            sheets = _sheets_of(path)
            cert_sheet = _cert_sheet(path, sheets, _cert_ordinal(n))
            item_sheet = _item_sheet(path, sheets)
            if not cert_sheet or not item_sheet:
                continue
            num = _cert_ordinal(n)
            if num > best_no:
                best, best_no = n, num
                sources["latestCertificate"] = {
                    "dir": package_dirs[0].replace("\\", "/"),
                    "file": n, "sheet": cert_sheet, "itemsSheet": item_sheet,
                }
        if not best:
            notes.append("no certificate workbook with an item breakdown was found")

    # ---------------------------------------------------------------- letter/meeting sources
    role_of = {"employer": "employer", "contractor": "contractor",
               "subcontractor": "subcontractor"}
    tok_role = {}
    if employer_tok:
        tok_role[employer_tok] = "employer"
    if sub_tok:
        tok_role[sub_tok] = "subcontractor"
    if ours:
        tok_role[ours] = "contractor"
    letters = []
    for s in series:
        other = s["other"] or s["prefix"]
        role = tok_role.get(other) or tok_role.get(s["prefix"]) or "employer"
        # The key names the counterparty, not the sender: both 'issued to' folders
        # are written by the same office, so a sender-based key would give them the
        # same name and one series would overwrite the other's label.
        key = ("%s_%s" % (s["side"], (other or s["prefix"] or "x").lower()))
        letters.append({
            "dir": s["dir"].replace("\\", "/"),
            "series": key,
            "contract": s["pkg"] or main_contract["id"],
            "side": s["side"],
            "label": ("Received from " if s["side"] == "received" else "Issued to ") + role,
        })
    meetings = []
    for rel in meeting_dirs:
        toks = [t for t in re.split(r"[-_\s]+", os.path.basename(rel)) if re.fullmatch(r"[A-Z]{2,6}", t)]
        toks = [t for t in toks if t.upper() not in ("MOM", "MEETING", "MEETINGS", "MINUTES")]
        ordered = ([ours] if ours in toks else []) + [t for t in toks if t != ours]
        key = " · ".join(ordered) if ordered else os.path.basename(rel)
        # minutes never state which package they belong to, so the subcontract book
        # is attached to the first package and the employer book to the main contract
        is_sub = any(tok_role.get(t) == "subcontractor" for t in toks)
        meetings.append({
            "dir": rel.replace("\\", "/"),
            "series": key,
            "contract": (next((c["id"] for c in contracts if c["kind"] == "sub"), "") if is_sub
                         else main_contract["id"]),
            "label": key,
        })

    # ---------------------------------------------------------------- project block
    project_name = (ms.get("project") or "").strip()
    if project_name:
        project_name = re.sub(r"\s*Contract\s*NO\.?.*$", "", project_name, flags=re.I).strip()
    project_name = project_name or name
    # The folder name is a directory, not a title: 'CYE_Project' says nothing about
    # the works. The caption under the panel is taken from the stated project name
    # and only falls back to the folder when no document names the project.
    short = re.sub(r"^(?:Upgrading|Enhancing|Construction|Rehabilitation|Extension)\s+(?:of\s+)?",
                   "", project_name, flags=re.I).strip()
    # 'Capacity of Coal Yard …' names the capability being added rather than the
    # works, so the leading 'Capacity of' is dropped when enough words remain.
    lead = re.match(r"^[A-Z]?[a-z]+\s+of\s+(.+)$", short)
    if lead and len(lead.group(1).split()) >= 3:
        short = lead.group(1)
    if len(short) > 34:
        short = " ".join(short.split()[:5])
    # '… Lakvijaya Power Station …' — the site is the installation the works are on,
    # which the project title carries and the certificates repeat.
    site_m = re.search(r"([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2}\s+"
                       r"(?:Power Station|Site|Plant|Terminal|Refinery|Mine|Substation))",
                       project_name + " " + (ms.get("site") or ""))
    return {
        "_notes": notes,
        "project": {
            "name": project_name,
            "short": (short or name)[:60],
            "mark": "".join(w[0] for w in re.split(r"[\s_-]+", short or name) if w)[:4].upper() or "EPC",
            "site": site_m.group(1).strip() if site_m else "",
            "standpoint": (ours or ""),
            "currency": (ms.get("currencies") or [""])[0],
            "currencies": [{"code": c, "label": ("US$" if c == "USD" else c),
                            "primary": i == 0} for i, c in enumerate(ms.get("currencies") or [])],
        },
        "parties": parties,
        "contracts": contracts,
        "sources": sources,
        "letters": letters,
        "meetings": meetings,
    }


def project_public(cfg):
    """The `project` block the client receives — identity only, no paths."""
    p = cfg["project"]
    by_role = {party_role(cfg, x["id"]): x for x in cfg["parties"]}
    out = dict(p)
    for role in ("employer", "contractor", "subcontractor"):
        src = by_role.get(role)
        out[role] = (src or {}).get("name", role.title())
        out[role + "Former"] = (src or {}).get("former", "")
    out["epcContract"] = cfg["subs"][0]["no"] if cfg["subs"] else cfg["main"]["no"]
    out["p02Contract"] = cfg["subs"][1]["no"] if len(cfg["subs"]) > 1 else ""
    out["mainContract"] = cfg["main"]["no"]
    out["client"] = out.get("employer", "")
    return out
