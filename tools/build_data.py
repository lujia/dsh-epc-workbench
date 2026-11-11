# -*- coding: utf-8 -*-
"""Build the EPC workbench data bundle from a project corpus.

Reads the corpus described by workbench.config.json and writes:

  data/workbench.json  aggregated, UI-ready facts (small enough to ship to the browser)
  data/index.json      compact searchable index of every letter / meeting / defect / IPC

Nothing about a particular project is hardcoded here: parties, contract numbers,
letter and meeting series and the folder layout all come from the configuration
file, so the same extractor builds a workbench for any EPC package laid out the
documented way. See docs/CONFIGURATION.md.

Usage:
    python tools/build_data.py                     # config auto-discovered
    python tools/build_data.py my-project.json     # explicit config
"""
import os, re, sys, json, datetime, warnings, math

import epc_config

warnings.filterwarnings("ignore")

# Filled by use_config(); module-level because every scanner needs the corpus
# root and most of them need nothing else from the configuration.
ROOT = ""
OUT = ""
CFG = None
SERIES_LABEL = {}        # letter series key -> display label
SERIES_CONTRACT = {}     # letter series key -> contract id
MEETING_CONTRACT = {}    # meeting series key -> contract id
PKG_TAGS = []            # [(token in a document reference, contract id)]
MAIN_DIR = ""
MAIN_CONTRACT_USD = ()
SCAN_RE = None
PROJECT = {}


def use_config(cfg):
    """Point the module at a loaded configuration."""
    global ROOT, OUT, CFG, SERIES_LABEL, SERIES_CONTRACT, MEETING_CONTRACT
    global PKG_TAGS, MAIN_DIR, MAIN_CONTRACT_USD, SCAN_RE, PROJECT
    CFG = cfg
    ROOT = epc_config.root_of(cfg)
    OUT = epc_config.out_of(cfg)
    SERIES_LABEL = {s["series"]: s["label"] for s in cfg["letters"]}
    SERIES_CONTRACT = {s["series"]: s["contract"] for s in cfg["letters"]}
    MEETING_CONTRACT = {s["series"]: s["contract"] for s in cfg["meetings"]}
    PKG_TAGS = [(c.get("tag") or c["id"], c["id"]) for c in cfg["subs"]]
    MAIN_DIR = cfg["sources"].get("mainContractDir") or ""
    MAIN_CONTRACT_USD = tuple(cfg["sources"].get("mainContractSums") or ())
    pattern = cfg["sources"].get("scanPattern")
    SCAN_RE = re.compile(pattern) if pattern else None
    PROJECT = epc_config.project_public(cfg)
    return cfg

MONTHS = {m: i + 1 for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july",
     "august", "september", "october", "november", "december"])}
for _m, _i in list(MONTHS.items()):
    MONTHS[_m[:3]] = _i
MONTHS["sept"] = 9

_MON_ALT = ("January|February|March|April|May|June|July|August|September|October|"
            "November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec")

# "12th August 2020" / "12 August, 2020" / "12" August 2020"
DATE_DMY = re.compile(
    r"(\d{1,2})\s*(?:st|nd|rd|th)?[^A-Za-z0-9]{0,5}(" + _MON_ALT + r")[^A-Za-z0-9]{0,3}((?:19|20)\d{2})",
    re.I)
# "August 12, 2020" / "September 10, 2025"
DATE_MDY = re.compile(
    r"(" + _MON_ALT + r")\s*(\d{1,2})\s*(?:st|nd|rd|th)?[^A-Za-z0-9]{0,3}((?:19|20)\d{2})",
    re.I)

YEAR_MIN, YEAR_MAX = 2019, 2027

HEADER_KEYS = {"DocType", "Direction", "LetterNo", "Subject", "SourceFile", "Role", "Seq"}


def clean(v):
    """Make a value JSON-safe."""
    if v is None:
        return None
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return round(v, 2)
    if isinstance(v, (int,)):
        return int(v)
    return v


def num(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        return round(float(v), 2)
    return None


def _mk(day, mon, year):
    mon = mon.lower()
    mon = mon if mon in MONTHS else mon[:3]
    if mon not in MONTHS:
        return None
    try:
        d = datetime.date(int(year), MONTHS[mon], int(day))
    except ValueError:
        return None
    return d if YEAR_MIN <= d.year <= YEAR_MAX else None


def parse_date(text):
    """First letter date in the text, whichever of the two orders appears first."""
    best = None
    for rx, order in ((DATE_DMY, "dmy"), (DATE_MDY, "mdy")):
        for m in rx.finditer(text):
            if order == "dmy":
                d = _mk(m.group(1), m.group(2), m.group(3))
            else:
                d = _mk(m.group(2), m.group(1), m.group(3))
            if d is not None and (best is None or m.start() < best[0]):
                best = (m.start(), d)
    return best[1].isoformat() if best else None


def iso_date(v):
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    if v is None:
        return None
    s = str(v).strip()
    for pat, fmt in ((r"(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})", "%Y-%m-%d"),):
        m = re.search(pat, s)
        if m:
            try:
                return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3))).isoformat()
            except ValueError:
                return None
    return parse_date(s)


# --------------------------------------------------------------------------- letters
CODE_RE = re.compile(r"-([A-Z]{1,4})-(\d{1,4})(?:~|$)")


def package_of(cfg, ref):
    """Contract id named inside a document reference, or ''.

    The reference itself records which package a letter belongs to
    ('…-P01-…' / '…-P02-…'), so the tag list comes from the configuration
    rather than from a hardcoded second regex.
    """
    for tag, cid in PKG_TAGS:
        if tag and ("-%s-" % tag) in ref:
            return cid
    return ""


def letter_header(path):
    with open(path, encoding="utf-8", errors="replace") as fh:
        head = fh.read(6000)
    out = {}
    for line in head.splitlines()[:12]:
        m = re.match(r"\[(\w+)\]\s*(.*)", line)
        if m and m.group(1) in HEADER_KEYS:
            out[m.group(1)] = m.group(2).strip()
    i = head.find("[OCR_TEXT]")
    out["_body"] = head[i + 10:] if i >= 0 else ""
    return out


def scan_letters(folder, series):
    base = os.path.join(ROOT, folder)
    rows = []
    if not os.path.isdir(base):
        return rows
    for name in sorted(os.listdir(base)):
        if not name.lower().endswith(".md"):
            continue
        path = os.path.join(base, name)
        try:
            h = letter_header(path)
        except OSError:
            continue
        no = h.get("LetterNo") or name.split("__")[0]
        body = h.get("_body", "")
        date = parse_date(body[:1500])
        if date is None:
            m = re.search(r"(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})", name)
            if m:
                try:
                    date = datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3))).isoformat()
                except ValueError:
                    date = None
        cm = CODE_RE.search(no)
        code = cm.group(1) if cm else ""
        rows.append({
            "no": no,
            "subj": (h.get("Subject") or "").strip()[:200],
            "date": date,
            "code": code,
            "pkg": package_of(None, no),
            "seq": h.get("Seq") or "01",
            "series": series,
            "file": os.path.join(folder, name),
        })
    return rows


def month_key(iso):
    return iso[:7] if iso else None


def aggregate_letters(letters):
    by_series = {}
    by_code = {}
    by_month = {}
    by_pkg = {}
    subjects = {}
    dated = []
    for r in letters:
        s = by_series.setdefault(r["series"], {"count": 0, "first": None, "last": None, "codes": {}})
        s["count"] += 1
        if r["date"]:
            dated.append(r)
            if s["first"] is None or r["date"] < s["first"]:
                s["first"] = r["date"]
            if s["last"] is None or r["date"] > s["last"]:
                s["last"] = r["date"]
        if r["code"]:
            s["codes"][r["code"]] = s["codes"].get(r["code"], 0) + 1
            by_code[r["code"]] = by_code.get(r["code"], 0) + 1
        if r["pkg"]:
            by_pkg[r["pkg"]] = by_pkg.get(r["pkg"], 0) + 1
        mk = month_key(r["date"])
        if mk:
            by_month[mk] = by_month.get(mk, 0) + 1
        if r["subj"]:
            key = re.sub(r"\s+", " ", r["subj"]).strip().lower()
            if 4 < len(key) < 90:
                subjects[key] = subjects.get(key, 0) + 1
    top_subjects = [{"subj": k, "count": v} for k, v in
                    sorted(subjects.items(), key=lambda kv: -kv[1])[:18]]
    recent = sorted([r for r in letters if r["date"]], key=lambda r: r["date"], reverse=True)[:24]
    return {
        "total": len(letters),
        "dated": len(dated),
        "bySeries": by_series,
        "byCode": dict(sorted(by_code.items(), key=lambda kv: -kv[1])),
        "byPkg": by_pkg,
        "byMonth": dict(sorted(by_month.items())),
        "topSubjects": top_subjects,
        "recent": [{"no": r["no"], "subj": r["subj"], "date": r["date"], "series": r["series"]} for r in recent],
    }


# --------------------------------------------------------------------------- meetings
def scan_meetings(folder, series):
    base = os.path.join(ROOT, folder)
    out = []
    if not os.path.isdir(base):
        return out
    for name in sorted(os.listdir(base)):
        low = name.lower()
        if not low.endswith(".md"):
            continue
        stem = name[:-3]
        m = re.search(r"(20\d{2})(\d{2})(\d{2})", stem)
        date = None
        if m:
            try:
                date = datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3))).isoformat()
            except ValueError:
                date = None
        ref = re.split(r"[\s_]", stem)[0]
        title = ""
        subj = ""
        try:
            with open(os.path.join(base, name), encoding="utf-8", errors="replace") as fh:
                head = fh.read(1600)
            for line in head.splitlines()[:8]:
                if line.startswith("# ") and not title:
                    title = line[2:].strip()
                low2 = line.lower()
                if not subj and "subject" in low2 and ":" in line:
                    subj = line.split(":", 1)[1].strip()[:160]
            if not title or title == stem:
                # Some minute books carry no markdown heading: their OCR body opens
                # with a banner such as 'SITE PROGRESS MEETTING MINUTES – 17/07/2020',
                # which reads far better in a table than the bare document number.
                for line in head.splitlines()[:40]:
                    text = line.strip()
                    if len(text) < 8 or len(text) > 120:
                        continue
                    if text.startswith("[") or text.startswith("#") or set(text) <= set("-—= "):
                        continue
                    if re.search(r"minute|meeting", text, re.I):
                        title = text
                        break
        except OSError:
            pass
        out.append({"ref": ref, "date": date, "title": (title or stem)[:160],
                    "subj": subj, "series": series,
                    "file": os.path.join(folder, name)})
    return out


def aggregate_meetings(rows):
    by_series = {}
    by_month = {}
    for r in rows:
        s = by_series.setdefault(r["series"], {"count": 0, "first": None, "last": None})
        s["count"] += 1
        if r["date"]:
            if s["first"] is None or r["date"] < s["first"]:
                s["first"] = r["date"]
            if s["last"] is None or r["date"] > s["last"]:
                s["last"] = r["date"]
            mk = month_key(r["date"])
            by_month[mk] = by_month.get(mk, 0) + 1
    dated = sorted([r for r in rows if r["date"]], key=lambda r: r["date"], reverse=True)
    return {
        "total": len(rows),
        "bySeries": by_series,
        "byMonth": dict(sorted(by_month.items())),
        "recent": [{"ref": r["ref"], "date": r["date"], "title": r["title"], "series": r["series"]} for r in dated[:30]],
        "all": [{"ref": r["ref"], "date": r["date"], "title": r["title"], "series": r["series"]} for r in dated],
        "undated": len(rows) - len(dated),
    }


# --------------------------------------------------------------------------- defects
def scan_defects():
    from openpyxl import load_workbook
    rel = (CFG["sources"].get("defects") or "") if CFG else ""
    if not rel:
        return []
    p = rel if os.path.isabs(rel) else os.path.join(ROOT, rel)
    if not os.path.isfile(p):
        return []
    wb = load_workbook(p, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = []
    for i, r in enumerate(ws.iter_rows(max_row=1600, values_only=True)):
        if i < 2:
            continue
        if not r or all(c is None for c in r):
            continue
        g = lambda k: r[k] if k < len(r) else None
        tgt = iso_date(g(13))
        rows.append({
            # Column 0 is the defect sequence; column 8 is the shared photo/doc ref,
            # which repeats for every defect recorded on the same photograph.
            "no": str(g(0) or "").strip(),
            "ref": str(g(8) or "").strip(),
            "disc": str(g(3) or "").strip(),
            "loc": str(g(9) or "").strip()[:60],
            "desc": str(g(10) or "").strip()[:220],
            "cat": str(g(11) or "").strip(),
            "act": str(g(12) or "").strip()[:140],
            "target": tgt,
            "status": str(g(14) or "").strip(),
            "days": num(g(15)),
            "prio": str(g(16) or "").strip(),
        })
    wb.close()
    return rows


def aggregate_defects(rows):
    by_status, by_disc, by_cat, by_prio, by_loc, by_month = {}, {}, {}, {}, {}, {}
    overdue = []
    for r in rows:
        by_status[r["status"] or "—"] = by_status.get(r["status"] or "—", 0) + 1
        by_disc[r["disc"] or "—"] = by_disc.get(r["disc"] or "—", 0) + 1
        by_cat[r["cat"] or "—"] = by_cat.get(r["cat"] or "—", 0) + 1
        by_prio[r["prio"] or "—"] = by_prio.get(r["prio"] or "—", 0) + 1
        by_loc[r["loc"] or "—"] = by_loc.get(r["loc"] or "—", 0) + 1
        if r["target"]:
            mk = month_key(r["target"])
            by_month[mk] = by_month.get(mk, 0) + 1
        if r["days"] is not None and r["days"] < 0 and r["status"].lower() != "closed":
            overdue.append(r)
    overdue.sort(key=lambda r: r["days"])
    return {
        "total": len(rows),
        "byStatus": dict(sorted(by_status.items(), key=lambda kv: -kv[1])),
        "byDiscipline": dict(sorted(by_disc.items(), key=lambda kv: -kv[1])),
        "byGrade": dict(sorted(by_cat.items(), key=lambda kv: -kv[1])),
        "byPriority": dict(sorted(by_prio.items(), key=lambda kv: -kv[1])),
        "byLocation": dict(sorted(by_loc.items(), key=lambda kv: -kv[1])[:14]),
        "byMonth": dict(sorted(by_month.items())),
        "overdue": overdue[:40],
        "overdueCount": len(overdue),
        "openCount": sum(v for k, v in by_status.items() if k.lower() != "closed"),
    }


# --------------------------------------------------------------------------- payments
def _register_path():
    """The master payment register workbook, if the project has one."""
    reg = CFG["sources"].get("paymentsRegister") or ""
    if not reg:
        return None
    p = reg if os.path.isabs(reg) else os.path.join(ROOT, reg)
    return p if os.path.isfile(p) else None


def load_monthly():
    from openpyxl import load_workbook
    p = _register_path()
    if p is None:
        return []
    sheet = CFG["sources"]["sheets"].get("monthly") or ""
    wb = load_workbook(p, read_only=True, data_only=True)
    if sheet not in wb.sheetnames:
        wb.close()
        return []
    ws = wb[sheet]
    rows = []
    for r in ws.iter_rows(max_row=90, values_only=True):
        if not r or r[0] is None:
            continue
        d = iso_date(r[0])
        if not d:
            continue
        rows.append({"date": d, "usd": num(r[1]), "lkr": num(r[2]), "vat": num(r[3])})
    wb.close()
    return rows


def load_ipcs():
    """Per-IPC certified amounts and payment state from the master payment register."""
    from openpyxl import load_workbook
    p = _register_path()
    if p is None:
        return [], []
    sheets = CFG["sources"]["sheets"]
    wb = load_workbook(p, read_only=True, data_only=True)
    ipcs = []
    ws = wb[sheets["ipc"]] if sheets.get("ipc") in wb.sheetnames else None
    if ws is not None:
        for r in ws.iter_rows(max_row=1200, values_only=True):
            if not r or r[2] is None:
                continue
            sn = str(r[2]).strip()
            amt = num(r[4])
            if amt is None:
                continue
            ipcs.append({
                "sn": sn,
                "date": iso_date(r[0]),
                "certified": num(r[3]),
                "amt": amt,
                "sscl": num(r[5]),
                "vat": num(r[6]),
                "sub": num(r[7]),
                "payDate": iso_date(r[8]),
                "fxLkr": num(r[9]),
                "fxRmb": num(r[10]),
                "rmb": num(r[11]),
                "note": str(r[12] or "").strip()[:100],
            })
    employer = []
    ws = wb[sheets["employer"]] if sheets.get("employer") in wb.sheetnames else None
    if ws is not None:
        for r in ws.iter_rows(max_row=1200, values_only=True):
            if not r or r[3] is None:
                continue
            amt = num(r[3])
            if amt is None:
                continue
            employer.append({
                "date": iso_date(r[1]),
                "no": str(r[2] or "").strip()[:40],
                "amt": amt,
                "tax": num(r[6]),
                "total": num(r[7]),
                "fxRmb": num(r[8]),
                "note": str(r[10] or "").strip()[:100],
                "recv": num(r[11]),
                "recvDate": iso_date(r[12]),
            })
    wb.close()
    return ipcs, employer


def load_retention(cid):
    """Retention and advance rows for one subcontract, from the configuration."""
    from openpyxl import load_workbook
    c = epc_config.contract(CFG, cid) if CFG else None
    if not c or not c.get("file"):
        return []
    rel = os.path.join(c["dir"], c["file"]) if c.get("dir") else c["file"]
    p = rel if os.path.isabs(rel) else os.path.join(ROOT, rel)
    if not os.path.isfile(p):
        return []
    has_period = c.get("has_period", True)
    wb = load_workbook(p, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    out = []
    for r in ws.iter_rows(max_row=80, values_only=True):
        if not r or not isinstance(r[0], str) or not r[0].upper().startswith("IPC"):
            continue
        if has_period:
            out.append({"ipc": r[0].strip(), "period": iso_date(r[1]) if r[1] else None,
                        "retThis": num(r[2]), "retCum": num(r[3]),
                        "advThis": num(r[4]), "advCum": num(r[5])})
        else:
            out.append({"ipc": r[0].strip(), "period": None,
                        "retThis": num(r[1]), "retCum": num(r[2]),
                        "advThis": num(r[3]), "advCum": num(r[4])})
    wb.close()
    return out


def latest_certificate():
    """Bill-item breakdown from the latest subcontract certificate, if configured."""
    from openpyxl import load_workbook
    src = (CFG["sources"].get("latestCertificate") or {}) if CFG else {}
    rel = os.path.join(src.get("dir") or "", src.get("file") or "")
    p = rel if os.path.isabs(rel) else os.path.join(ROOT, rel)
    out = {"no": None, "period": None, "date": None, "items": [], "summary": {}}
    if not src.get("file") or not os.path.isfile(p):
        return out
    wb = load_workbook(p, read_only=True, data_only=True)
    cert_sheet = src.get("sheet") or ""
    item_sheet = src.get("itemsSheet") or ""
    if cert_sheet and cert_sheet in wb.sheetnames:
        ws = wb[cert_sheet]
        for r in ws.iter_rows(max_row=40, values_only=True):
            cells = list(r)
            rowtxt = " ".join(str(c) for c in cells if c is not None)
            if out["no"] is None:
                m = re.search(r"NO\.:\s*([A-Z][\w./-]*(?:IPC|IP)[\w./-]*)", rowtxt)
                if m:
                    out["no"] = m.group(1).strip()
            if "Period Ending" in rowtxt and out["period"] is None:
                for c in cells:
                    d = iso_date(c) if not isinstance(c, str) or re.search(r"\d{4}-\d{2}-\d{2}", c) else None
                    if d:
                        out["period"] = d
                        break
            if "Date" in rowtxt and out["date"] is None:
                for c in reversed(cells):
                    if isinstance(c, str):
                        continue
                    d = iso_date(c)
                    if d:
                        out["date"] = d
                        break
            label = str(cells[2] if len(cells) > 2 else "")
            val = None
            for c in reversed(cells[8:] if len(cells) > 8 else cells):
                if isinstance(c, (int, float)):
                    val = num(c)
                    break
            low = label.lower()
            if "certified up to previous" in low:
                out["summary"]["previous"] = val
            elif "for this certificate" in low:
                out["summary"]["current"] = val
            elif "up to this certificate" in low:
                out["summary"]["cumulative"] = val
            elif "advance payment recovery" in low:
                out["summary"]["advanceRecovery"] = val
            elif "retention up to 5%" in low:
                out["summary"]["retention"] = val
            elif "net certified" in low:
                out["summary"]["netCertified"] = val
            elif "net payable" in low:
                out["summary"]["netPayable"] = val
    if item_sheet and item_sheet in wb.sheetnames:
        ws = wb[item_sheet]
        for r in ws.iter_rows(max_row=100, values_only=True):
            cells = list(r)
            if len(cells) < 6:
                continue
            code = str(cells[0] or "").strip()
            desc = str(cells[1] or "").strip()
            boq, prev, cur, cum = num(cells[2]), num(cells[3]), num(cells[4]), num(cells[5])
            if not desc or boq is None:
                continue
            if desc.upper().startswith("GRAND SUMMARY") or desc.upper() == "SUB TOTAL":
                continue
            out["items"].append({"code": code, "desc": desc[:70], "boq": boq,
                                 "prev": prev, "cur": cur, "cum": cum})
    wb.close()
    out["items"] = out["items"][:40]
    return out


def aggregate_payments(ipcs, employer, monthly):
    def month_sum(rows, key, valkey):
        acc = {}
        for r in rows:
            d = r.get(key)
            if not d:
                continue
            mk = month_key(d)
            v = r.get(valkey)
            if v is None:
                continue
            acc[mk] = round(acc.get(mk, 0.0) + v, 2)
        return dict(sorted(acc.items()))

    paid_by_month = month_sum(ipcs, "payDate", "sub")
    invoiced_by_month = month_sum(ipcs, "date", "sub")
    recv_by_month = month_sum(employer, "recvDate", "recv")
    employer_inv_month = month_sum(employer, "date", "total")

    # payment lag: invoice date -> payment date
    lags = []
    for r in ipcs:
        if r["date"] and r["payDate"]:
            try:
                a = datetime.date.fromisoformat(r["date"])
                b = datetime.date.fromisoformat(r["payDate"])
                lags.append((b - a).days)
            except ValueError:
                pass
    lags.sort()
    avg_lag = round(sum(lags) / len(lags), 1) if lags else None
    med_lag = lags[len(lags) // 2] if lags else None

    fx = [{"date": r["payDate"] or r["date"], "lkr": r["fxLkr"], "rmb": r["fxRmb"]}
          for r in ipcs if r["fxLkr"]]
    fx.sort(key=lambda r: r["date"] or "")

    total_paid = round(sum(r["sub"] or 0 for r in ipcs), 2)
    total_cert = round(sum(r["amt"] or 0 for r in ipcs), 2)
    unpaid = [r for r in ipcs if r.get("sub") and not r.get("payDate")]
    return {
        "ipcs": ipcs,
        "employer": employer[-120:],
        "paidByMonth": paid_by_month,
        "invoicedByMonth": invoiced_by_month,
        "receivedByMonth": recv_by_month,
        "employerInvoicedByMonth": employer_inv_month,
        "monthly": monthly,
        "lag": {"avg": avg_lag, "median": med_lag, "n": len(lags), "max": lags[-1] if lags else None},
        "fx": fx,
        "totals": {
            "certified": total_cert,
            "paid": total_paid,
            "employerInvoiced": round(sum(r["total"] or 0 for r in employer), 2),
            "employerReceived": round(sum(r["recv"] or 0 for r in employer), 2),
            "unpaidCount": len(unpaid),
            "unpaidAmount": round(sum(r["sub"] or 0 for r in unpaid), 2),
        },
    }


# --------------------------------------------------------------------------- main contract
# Main-contract certificates are a different document family from the subcontract
# IPCs: one workbook per certificate, an "INTERIM PAYMENTS APPLICATION" BOQ sheet in
# every file, and a summary sheet that only the later certificates carry. Certificates
# that exist as scanned PDFs only cannot be parsed and are reported as gaps.
MAIN_ERA_GAP = 3.0

# label fragments -> output key; longer keys first so 'repayment of advance payment'
# is not swallowed by 'advance payment'
MAIN_LABELS = (
    ("repayment of advance payment", "advanceRepay"),
    ("limit of retention money", "retentionLimit"),
    ("total deductions", "deductions"),
    ("retention (", "retention"),
    ("advance payment", "advance"),
    ("sub-total - a", "a"),
    ("sub-total - b", "b"),
    ("sub-total - c", "c"),
    ("sub-total - d", "d"),
    ("sub-total - e", "e"),
    ("gross valuation", "gross"),
    ("i) total", "total"),
    ("k) present claim", "present"),
    ("amount due", "due"),
    ("add.price adjustment", "adjust"),
    ("price adjustment", "adjust"),
)


def _main_ipa_no(name):
    m = re.search(r"IPA[\s\-_]*(\d+)", name, re.I)
    return int(m.group(1)) if m else None


def _money(cells, i):
    return num(cells[i]) if len(cells) > i else None


def _ms_money(cells):
    """Column map of the 'M-S' summary sheet."""
    return {"contractUsd": _money(cells, 4), "contractLkr": _money(cells, 5),
            "prevUsd": _money(cells, 8), "prevLkr": _money(cells, 9),
            "curUsd": _money(cells, 10), "curLkr": _money(cells, 11),
            "cumUsd": _money(cells, 12), "cumLkr": _money(cells, 13)}


def _app_money(cells):
    """Column map of the 'INTERIM PAYMENTS APPLICATION' totals row — it has no
    contract-sum service column, so the money block starts at index 5."""
    return {"prevUsd": _money(cells, 5), "prevLkr": _money(cells, 6),
            "curUsd": _money(cells, 8), "curLkr": _money(cells, 9),
            "cumUsd": _money(cells, 11), "cumLkr": _money(cells, 12)}


def _main_totals_row(ws):
    """The application sheet's grand-total row: the first blank-labelled row whose
    contract-sum cell equals the contract value of that era."""
    fallback = None
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=200, max_col=16, values_only=True), 1):
        cells = list(row)
        if len(cells) < 3:
            continue
        v = cells[2]
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            continue
        if any(abs(v - c) < MAIN_ERA_GAP for c in MAIN_CONTRACT_USD):
            if not (cells[0] or cells[1]):
                return i, cells
            if fallback is None:
                fallback = (i, cells)
    return fallback if fallback else (None, None)


def _main_period(ws, name):
    """'for the period ending on 10th February 2021' lives on row 1 of the application sheet."""
    for row in ws.iter_rows(min_row=1, max_row=6, max_col=4, values_only=True):
        txt = " ".join(str(c) for c in row if c is not None)
        if "period" in txt.lower():
            d = parse_date(txt)
            if d:
                return d
    m = re.search(r"(20\d{2})(\d{2})(\d{2})", name)
    if m:
        try:
            return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3))).isoformat()
        except ValueError:
            return None
    return None


def _ms_sheet(wb):
    for name in wb.sheetnames:
        if name.strip().lower() == "m-s":
            return wb[name]
    return None


def _main_summary(wb):
    """Bills and block totals from the M-S summary sheet (IPA-29 onward only)."""
    ws = _ms_sheet(wb)
    if ws is None:
        return None
    bills = []
    groups = {}
    descs = {}
    in_bills = True
    for row in ws.iter_rows(min_row=8, max_row=110, max_col=14, values_only=True):
        cells = list(row)
        desc = str(cells[3] or "").strip() if len(cells) > 3 else ""
        code = str(cells[2] or "").strip() if len(cells) > 2 else ""
        low = " ".join(str(c) for c in cells[:6] if c is not None).strip().lower()
        if desc.lower().startswith("sub-total"):
            # Bills 1-5 close with "Sub-Total - A", but the provisional sum (6) and the two
            # contingency items (7, 8) still belong to the contract sum, so keep collecting
            # through section C and stop only where the price-adjustment section starts.
            continue
        if "price adjustment" in low or desc.lower().startswith(("add.", "ddt.")):
            # Section E reuses the same 1..8 item codes for the duty fee and the eight
            # Documents-Against-Acceptance deductions; those are not bills.
            in_bills = False
        # The sheet wraps long bill names onto the group row (code "1" .. "5") while the
        # money sits on the sub-item row (code "1.1~1.17") whose own description is elided
        # to "Site Management,…". Keep the group-row wording and use it for the bill.
        if in_bills and desc and code.isdigit():
            if len(desc) > len(descs.get(code, "")):
                descs[code] = desc
        if in_bills and desc and isinstance(_money(cells, 4), float):
            if len(bills) < 8 and desc.upper() != "JPY":
                bills.append(dict(_ms_money(cells), code=code, desc=desc[:88]))
        # 'Amount Due This Statement.' and 'Deduct Previouslly Certified.' put their
        # label in column L and their money in M:N, so the label scan has to look at
        # every cell, not only the first six columns used by the bill rows. The
        # emptiness test therefore applies to the whole row, not to cells[:6].
        label_low = " ".join(str(c) for c in cells if c is not None).strip().lower()
        if not label_low or len(label_low) < 5:
            continue
        for frag, key in MAIN_LABELS:
            if frag in label_low:
                block = _ms_money(cells)
                # Section headers such as 'E) Price Adjustment & Other' carry the words
                # but no figures; keep looking until a row actually holds the money.
                if key not in groups or (groups[key].get("cumLkr") is None and block.get("cumLkr") is not None):
                    groups[key] = block
                break
    for bill in bills:
        group = str(bill["code"]).split(".")[0].strip()
        if len(descs.get(group, "")) > len(bill["desc"]):
            bill["desc"] = descs[group][:88]
    return {"bills": bills, "totals": groups}


def _read_ipa_ledger(wb):
    """'IPA Details' — one row per certificate with the price-adjustment columns.
    Only workbooks from IPA-29 on carry it, and it lists every IPA in the project,
    so a single read is enough for the whole series."""
    for name in wb.sheetnames:
        if name.strip().lower() != "ipa details":
            continue
        ws = wb[name]
        out = []
        for row in ws.iter_rows(min_row=5, max_row=70, max_col=16, values_only=True):
            cells = list(row)
            no = cells[0]
            if isinstance(no, str) and no.strip().upper().startswith("IPA"):
                m = re.search(r"(\d+)", no)
                no = int(m.group(1)) if m else None
            if not isinstance(no, int) or no <= 0:
                continue
            out.append({
                "ipa": no,
                "monthly": _money(cells, 1),
                "cumulative": _money(cells, 2),
                "employerMonth": _money(cells, 10),
                "employerCum": _money(cells, 11),
                "contractorMonth": _money(cells, 12),
                "contractorCum": _money(cells, 13),
                "nonAdjustable": _money(cells, 14),
                "remark": str(cells[15] or "").strip()[:60],
            })
        return out
    return []


ORDINAL_RE = re.compile(r"(\d+)\s*(?:st|nd|rd|th)\b", re.I)


def _certificate_ordinal(name):
    m = ORDINAL_RE.search(name)
    return int(m.group(1)) if m else None


def scan_certificate_pdfs(folder):
    """Index the signed certificate scans sitting beside the workbooks.

    There is no PDF text layer in these files — they are page images — and the
    bundled python has no PDF library at all, so the scan can only be indexed by
    what the filename states: the invoice reference (P-0NN), the certificate
    ordinal (the '6th Interim Payment' wording), the issuing employer name that
    was current when the sheet was signed, and the file size. That is still
    enough for the register: an auditor wants to know which certificate has a
    signed copy on file and where.
    """
    base = os.path.join(ROOT, folder)
    out = []
    if not os.path.isdir(base):
        return out
    for name in sorted(os.listdir(base)):
        if not name.lower().endswith(".pdf"):
            continue
        path = os.path.join(base, name)
        low = name.lower()
        m = SCAN_RE.match(name)
        ordinal = _certificate_ordinal(name)
        out.append({
            "name": name,
            "size": os.path.getsize(path),
            "ref": ("P-" + m.group("ref").zfill(3)) if m else None,
            "ordinal": ordinal,
            "issuer": m.group("party") if m else None,
            "amended": "revised" in low or "amend" in low,
            "enclosure": "enclosure" in low,
        })
    # The folder holds several byte-different copies of the same certificate
    # (P-009 has three). For the register one row per certificate is what matters,
    # so collapse by reference and keep the largest copy, recording how many exist.
    merged = {}
    order = []
    for s in out:
        key = (s["ref"], s["ordinal"], s["enclosure"], s["amended"])
        prev = merged.get(key)
        if prev is None:
            s["copies"] = 1
            merged[key] = s
            order.append(key)
        else:
            prev["copies"] += 1
            if s["size"] > prev["size"]:
                keep_copies = prev["copies"]
                s["copies"] = keep_copies
                merged[key] = s
    return [merged[k] for k in order]


def load_main_ipas():
    """Per-IPA main-contract certificate series plus the price-adjustment ledger."""
    from openpyxl import load_workbook
    d = os.path.join(ROOT, MAIN_DIR)
    if not os.path.isdir(d):
        return None
    rows, pdf_only, by_no = [], [], {}
    ledger, summary_latest = [], None
    for name in sorted(os.listdir(d)):
        no = _main_ipa_no(name)
        if no is None:
            continue
        path = os.path.join(d, name)
        if not name.lower().endswith(".xlsx"):
            pdf_only.append(no)
            continue
        try:
            wb = load_workbook(path, read_only=True, data_only=True)
        except Exception:
            pdf_only.append(no)
            continue
        app = None
        for sheet in wb.sheetnames:
            if "APPLICATION" in sheet.upper():
                app = wb[sheet]
                break
        if app is None:
            wb.close()
            continue
        _, cells = _main_totals_row(app)
        if cells is None:
            wb.close()
            continue
        row = dict(_app_money(cells), ipa=no, period=_main_period(app, name), file=name)
        ms = _main_summary(wb)
        row["summary"] = ms is not None
        if ms:
            for key in ("a", "b", "c", "d", "e", "gross", "adjust", "total", "present", "due",
                        "advance", "retention", "retentionLimit", "advanceRepay",
                        "deductions"):
                block = ms["totals"].get(key)
                if block and block.get("cumLkr") is not None:
                    row[key + "CumLkr"] = block["cumLkr"]
                    row[key + "CumUsd"] = block["cumUsd"]
                elif block and block.get("contractLkr") is not None:
                    # The retention cap is quoted as a contract limit, not as a
                    # cumulative figure, so it lands in the contract columns.
                    row[key + "CumLkr"] = block["contractLkr"]
                    row[key + "CumUsd"] = block["contractUsd"]
            blocks = {b["desc"].upper(): b for b in ms["bills"]}
            row["bills"] = ms["bills"]
            if summary_latest is None or no > summary_latest["ipa"]:
                summary_latest = dict(row)
            # the ledger lists every IPA in the project, but each workbook only keeps
            # the rows up to its own certificate — the newest workbook wins
            found = _read_ipa_ledger(wb)
            if len(found) > len(ledger):
                ledger = found
        wb.close()
        # '-50-F.xlsx' and '-50-F-计算保留金.xlsx' are the same certificate
        keep = by_no.get(no)
        if keep is None or (not keep["summary"] and row["summary"]):
            by_no[no] = row
    rows = [by_no[k] for k in sorted(by_no)]

    have = set(by_no) | set(pdf_only)
    missing = [i for i in range(1, (max(have) if have else 0) + 1) if i not in have]

    by_period = {}
    for r in rows:
        if not r.get("period"):
            continue
        acc = by_period.setdefault(month_key(r["period"]), {"usd": 0.0, "lkr": 0.0})
        acc["usd"] += r.get("curUsd") or 0.0
        acc["lkr"] += r.get("curLkr") or 0.0
    by_period = {k: {"usd": round(v["usd"], 2), "lkr": round(v["lkr"], 2)}
                 for k, v in sorted(by_period.items())}

    return {
        "folder": MAIN_DIR,
        "files": len([f for f in os.listdir(d) if os.path.isfile(os.path.join(d, f))]),
        "parsed": len(rows),
        "pdfOnly": sorted(set(pdf_only)),
        "missing": missing,
        "ipas": rows,
        "ledger": ledger,
        "byPeriod": by_period,
        "latest": summary_latest,
        "scans": scan_certificate_pdfs(MAIN_DIR),
        "contract": _main_contract_block(),
        "totals": {
            "certifiedUsd": rows[-1]["cumUsd"] if rows else None,
            "certifiedLkr": rows[-1]["cumLkr"] if rows else None,
            "count": len(rows),
            "lastIpa": rows[-1]["ipa"] if rows else None,
        },
    }


# --------------------------------------------------------------------------- documents
def _dir(rel):
    """Absolute path for a configured document directory, or None."""
    if not rel:
        return None
    p = rel if os.path.isabs(rel) else os.path.join(ROOT, rel)
    return p if os.path.isdir(p) else None


def _files(d):
    if d is None:
        return []
    try:
        return [f for f in sorted(os.listdir(d)) if os.path.isfile(os.path.join(d, f))]
    except OSError:
        return []


def scan_docs():
    docs = (CFG["sources"].get("docs") or {}) if CFG else {}
    contracts = []
    cdir = _dir(docs.get("contracts"))
    for name in _files(cdir):
        p = os.path.join(cdir, name)
        if name.lower().endswith((".md", ".pdf")):
            contracts.append({"name": name, "size": os.path.getsize(p),
                              "ext": name.rsplit(".", 1)[-1].lower()})
    toc = []
    tdir = _dir(docs.get("toc"))
    for name in _files(tdir):
        p = os.path.join(tdir, name)
        low = name.lower()
        issued = low.endswith(".pdf") and ("certificate" in low)
        toc.append({"name": name, "size": os.path.getsize(p),
                    "state": "issued" if issued else "draft"})
    mats = []
    mdir = _dir(docs.get("materials"))
    if mdir is not None:
        for name in sorted(os.listdir(mdir)):
            p = os.path.join(mdir, name)
            if os.path.isdir(p):
                try:
                    mats.append({"name": name, "files": len(os.listdir(p))})
                except OSError:
                    mats.append({"name": name, "files": 0})
    counts = {"photos": len(_files(_dir(docs.get("photos")))),
              "videos": len(_files(_dir(docs.get("videos")))),
              "pdfLetters": len(_files(_dir(docs.get("pdfLetters"))))}
    return {"contracts": contracts, "toc": toc, "materials": mats, "media": counts}


# --------------------------------------------------------------------------- register
def _main_contract_block():
    """Contract facts for the main-contract card, straight from the configuration."""
    c = (CFG["main"] if CFG else {}) or {}
    out = {
        "no": c.get("no") or "",
        "lkr": c.get("value"),
        "usd": c.get("valueUsd"),
        "revisedLkr": c.get("valueRevised") or c.get("value"),
        "originalLkr": c.get("originalValue") or c.get("value"),
        "originalUsd": c.get("originalValueUsd") or c.get("valueUsd"),
        "advancePct": c.get("advancePct"),
        "retentionPct": c.get("retentionPct"),
    }
    return out


def contract_register(main_contract, retention=None):
    """The contracts the workbench can be read against, in the order it shows them.

    Every view puts this register in a scope switcher, so the shape has to carry
    everything a switcher label needs: the contract number, who the other party
    is, the value in the currency the contract is actually measured in, and how
    many records the dataset holds for it.
    """
    mc = main_contract or {}
    contract = mc.get("contract") or {}
    totals = mc.get("totals") or {}
    ret = retention or {}
    register = []
    for c in (CFG["contracts"] if CFG else []):
        party = epc_config.party(CFG, c["counterparty"])
        entry = {
            "id": c["id"],
            "kind": c["kind"],
            "no": c["no"],
            "label": c.get("label") or c["id"],
            # the reference token ('P01') is how the client attributes a document
            # to a contract when the reference itself records it
            "tag": c.get("tag") or "",
            "counterparty": party.get("abbr") or party.get("name") or c["counterparty"],
            "counterpartyName": party.get("name") or c["counterparty"],
            "counterpartyRole": party.get("role") or c["counterparty"],
            "currency": c.get("currency") or "",
            "value": c.get("value"),
            "valueOrig": None,
            "valueUsd": c.get("valueUsd"),
            "records": len(ret.get(c["id"]) or []) if c["kind"] == "sub" else (totals.get("count") or 0),
            "issuer": epc_config.party_short(CFG, c.get("issuer") or "contractor"),
        }
        if c["kind"] == "main":
            # the revised price is what the certificates are measured against, so the
            # register quotes it and keeps the original sum beside it
            entry["value"] = contract.get("revisedLkr") or contract.get("lkr") or c.get("value")
            entry["valueOrig"] = contract.get("lkr") or c.get("value")
        register.append(entry)
    if register:
        return register
    c = (CFG["main"] if CFG else {}) or {}
    return [{
        "id": c.get("id") or "MAIN",
        "kind": "main",
        "no": c.get("no") or "",
        "label": c.get("label") or "Main contract",
        "counterparty": "",
        "counterpartyName": "",
        "counterpartyRole": "employer",
        "currency": c.get("currency") or "",
        "value": contract.get("revisedLkr") or c.get("value"),
        "valueOrig": contract.get("lkr") or c.get("value"),
        "valueUsd": c.get("valueUsd"),
        "records": totals.get("count") or 0,
        "issuer": "",
    }]


def build_taxonomy():
    """The vocabulary the client needs to read the dataset without knowing the project.

    Which series belong to the main contract, which contract a series or a
    meeting book belongs to, and the order the rail shows them in — all of it is
    configuration, so it has to travel with the data rather than be inferred from
    series names the client would otherwise have to hardcode.
    """
    contracts = []
    parties = []
    for p in CFG["parties"]:
        parties.append({
            "id": p["id"],
            "name": p.get("name") or p["id"],
            "former": p.get("former") or "",
            "abbr": p.get("abbr") or p.get("name") or p["id"],
            "role": p.get("role") or p["id"],
        })
    for c in CFG["contracts"]:
        party = epc_config.party(CFG, c["counterparty"])
        contracts.append({
            "id": c["id"],
            "kind": c["kind"],
            "no": c["no"],
            "label": c.get("label") or c["id"],
            # the reference token ('P01') is how the client attributes a document
            # to a contract when the reference itself records it
            "tag": c.get("tag") or "",
            "counterparty": party.get("abbr") or party.get("name") or "",
            "counterpartyName": party.get("name") or "",
            "counterpartyRole": party.get("role") or "",
            "roleLabel": "",
            "currency": c.get("currency") or "",
        })
    return {
        "contracts": contracts,
        "parties": parties,
        "letters": [{"key": s["series"], "label": s["label"], "contract": s["contract"],
                     "side": s["side"]} for s in CFG["letters"]],
        "meetings": [{"key": s["series"], "label": s["label"],
                      "contract": s["contract"]} for s in CFG["meetings"]],
    }


def main(argv=None):
    use_config(epc_config.load(epc_config.locate(argv)))
    os.makedirs(OUT, exist_ok=True)

    print("scanning letters ...")
    letters = []
    for src in CFG["letters"]:
        letters += scan_letters(src["dir"], src["series"])
    print("  letters:", len(letters))

    print("scanning meetings ...")
    meetings = []
    for src in CFG["meetings"]:
        meetings += scan_meetings(src["dir"], src["series"])
    print("  meetings:", len(meetings))

    print("scanning defects ...")
    defects = scan_defects()
    print("  defects:", len(defects))

    print("reading payment registers ...")
    monthly = load_monthly()
    ipcs, employer = load_ipcs()
    print("  ipc rows:", len(ipcs), "employer rows:", len(employer))

    retention = {}
    for c in CFG["subs"]:
        retention[c["id"]] = load_retention(c["id"])
    print("  retention rows:", dict((k, len(v)) for k, v in retention.items()))

    print("reading latest certificate ...")
    cert = latest_certificate()
    print("  certificate:", cert["no"], len(cert["items"]), "items")

    docs = scan_docs()

    print("reading main-contract certificates ...")
    main_contract = load_main_ipas()
    if main_contract:
        print("  main certificates:", main_contract["parsed"], "pdf-only:", main_contract["pdfOnly"],
              "ledger:", len(main_contract["ledger"]))

    sub0 = CFG["subs"][0]["id"] if CFG["subs"] else ""

    data = {
        "generated": datetime.datetime.now().isoformat(timespec="seconds"),
        "project": PROJECT,
        "taxonomy": build_taxonomy(),
        "contracts": contract_register(main_contract, retention),
        "letters": aggregate_letters(letters),
        "meetings": aggregate_meetings(meetings),
        "defects": aggregate_defects(defects),
        "payments": aggregate_payments(ipcs, employer, monthly),
        "retention": retention,
        "certificate": cert,
        "mainContract": main_contract,
        "docs": docs,
        "defectRows": defects[:400],
    }

    p = os.path.join(OUT, "workbench.json")
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    print("WROTE", p, os.path.getsize(p))

    index = []
    for r in letters:
        index.append(["L", r["no"], r["date"], r["subj"], r["series"], r["file"]])
    for r in meetings:
        index.append(["M", r["ref"], r["date"], r["title"], r["series"], r["file"]])
    for r in defects:
        index.append(["D", r["ref"], r["target"], r["desc"], r["disc"] + "/" + r["cat"], None])
    for r in ipcs:
        index.append(["I", "IPC " + r["sn"], r["date"],
                      "Certified %s · paid %s" % (r["amt"], r["sub"] or 0), sub0, None])
    mc_id = CFG["main"]["id"]
    for r in (main_contract["ipas"] if main_contract else []):
        index.append(["C", "%s-%02d" % (CFG["main"]["no"] or "IPA", r["ipa"]), r["period"],
                      "Main contract certified %s" % (r["cumLkr"] or 0), mc_id, r["file"]])
    for s in (main_contract["scans"] if main_contract else []):
        ordinal = s["ordinal"]
        index.append(["S", s["ref"] or s["name"], None,
                      ("Signed certificate scan — %s Interim Payment%s" % (
                          str(ordinal) + ("th" if ordinal and 11 <= ordinal % 100 <= 13 else
                                          {1: "st", 2: "nd", 3: "rd"}.get(ordinal % 10 if ordinal else 0, "th")),
                          " (amended)" if s["amended"] else "")) if ordinal else s["name"],
                      mc_id, os.path.join(MAIN_DIR, s["name"])])
    pi = os.path.join(OUT, "index.json")
    with open(pi, "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
    print("WROTE", pi, os.path.getsize(pi), len(index), "records")


if __name__ == "__main__":
    main(sys.argv)
