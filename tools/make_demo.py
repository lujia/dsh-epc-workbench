#!/usr/bin/env python3
"""Write the demo dataset the plugin ships with.

The workbench itself is a reader: tools/build_data.py turns a real project
folder into data/workbench.json and data/index.json. Anyone who installs the
plugin without a project folder still needs a page that renders, and nobody
should have to publish their own contract to look at the UI.

So this script invents a project and produces exactly the payload build_data.py
produces, from the same schema: three contracts, four letter series, two minute
books, a defect register, subcontract certificates, a main-contract certificate
series and a handful of scanned certificates. Every name, number and date here
is fictional.

    python tools/make_demo.py

Writes data/workbench.json and data/index.json next to the package. Deterministic:
the same seed always produces the same dataset, so a screenshot in the README
stays valid.
"""

import json
import os
import random
import statistics
from datetime import date, datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)
OUT = os.path.join(PKG, "data")

RNG = random.Random(20210507)

# --------------------------------------------------------------------------
# The invented project. Nothing here refers to a real employer, contractor,
# site or contract number; keep it that way.
# --------------------------------------------------------------------------

PROJECT = {
    "name": "Northern Ring Substation Upgrade",
    "short": "NRS — Substation Upgrade",
    "mark": "NRS",
    "site": "Port of Almar, Valtera",
    "standpoint": "Meridian",
    "currency": "USD",
    "secondary": "EUR",
    "employer": "Northern Grid Authority",
    "employerFormer": "",
    "contractor": "Meridian Engineering Ltd",
    "contractorFormer": "",
    "subcontractor": "Coastal Works Ltd",
    "subcontractorFormer": "Harbour Civil Works",
}

PARTIES = [
    {"id": "employer", "name": "Northern Grid Authority", "former": "", "abbr": "NGA", "role": "employer"},
    {"id": "contractor", "name": "Meridian Engineering Ltd", "former": "", "abbr": "MEL", "role": "contractor"},
    {"id": "subcontractor", "name": "Coastal Works Ltd", "former": "Harbour Civil Works", "abbr": "CWL", "role": "subcontractor"},
]

CONTRACTS = [
    {
        "id": "MAIN", "kind": "main", "no": "NGA/EPC/2021/07", "label": "Main contract",
        "tag": "MAIN", "counterparty": "NGA", "issuer": "MEL",
        "counterpartyName": "Northern Grid Authority", "counterpartyRole": "employer",
        "currency": "USD",
        "value": 96600000.0, "valueOrig": 84000000.0, "valueUsd": 7600000.0,
        "records": 14,
    },
    {
        "id": "P01", "kind": "sub", "no": "MEL-SUB-2021-11", "label": "Package 1",
        "tag": "P01", "counterparty": "CWL", "issuer": "MEL",
        "counterpartyName": "Coastal Works Ltd", "counterpartyRole": "subcontractor",
        "currency": "USD",
        "value": 31500000.0, "valueOrig": None, "valueUsd": 0.0, "records": 24,
    },
    {
        "id": "P02", "kind": "sub", "no": "MEL-SUB-2021-12", "label": "Package 2",
        "tag": "P02", "counterparty": "CWL", "issuer": "MEL",
        "counterpartyName": "Coastal Works Ltd", "counterpartyRole": "subcontractor",
        "currency": "USD",
        "value": 44200000.0, "valueOrig": None, "valueUsd": 0.0, "records": 28,
    },
]

LETTER_SERIES = [
    {"key": "issued_p01", "label": "Issued to subcontractor", "contract": "P01", "side": "issued"},
    {"key": "received_p01", "label": "Received from subcontractor", "contract": "P01", "side": "received"},
    {"key": "issued_p02", "label": "Issued to subcontractor", "contract": "P02", "side": "issued"},
    {"key": "received_p02", "label": "Received from subcontractor", "contract": "P02", "side": "received"},
    {"key": "issued_nga", "label": "Issued to employer", "contract": "MAIN", "side": "issued"},
    {"key": "received_nga", "label": "Received from employer", "contract": "MAIN", "side": "received"},
]

MEETING_SERIES = [
    {"key": "MEL · NGA", "label": "MEL · employer", "contract": "MAIN"},
    {"key": "MEL · CWL", "label": "MEL · subcontractor", "contract": "P01"},
]

CODES = {
    "issued_p01": ["C", "G", "P", "DR", "MS", "QC"],
    "received_p01": ["C", "P", "G", "MA", "MS", "QC", "WR"],
    "issued_p02": ["C", "P", "G", "QC", "MS"],
    "received_p02": ["C", "P", "MA", "QC"],
    "issued_nga": ["C", "P", "DGM", "DR", "MS", "TR", "WR"],
    "received_nga": ["C", "P", "G", "E", "MS", "DM"],
}

SUBJECTS = [
    "Request for approval of method statement",
    "Site instruction for cable trench diversion",
    "Monthly progress report",
    "Request for extension of time",
    "Inspection and test plan for switchgear",
    "Non-conformance report — concrete cover",
    "Request for information — earthing layout",
    "Interim payment application",
    "Variation proposal — foundation detail",
    "Handover of area 3 to the civil package",
    "Weekly coordination minutes",
    "Material submittal for cable trays",
    "Defect close-out report",
    "Site access and permit arrangements",
]

DEFECT_LOCATIONS = [
    "Reactor Bay", "Control Building", "Cable Trench", "Gantry A", "Gantry B",
    "Switchyard North", "Earthing Grid", "Auxiliary Transformer",
]
DEFECT_DESC = [
    "grout not flush with base plate", "cable tray earth bond missing",
    "anchor bolt protrusion beyond nut", "fire seal to wall penetration incomplete",
    "conduit elbow cracked", "label plate illegible", "paint damage to gantry leg",
    "trench cover not seated", "door closer out of adjustment",
]
DEFECT_RESOLVE = [
    "rework instructed", "accepted with note", "closed after reinspection",
    "raised as non-conformance", "monitor at next walk",
]

START = date(2021, 3, 1)
END = date(2024, 11, 30)
SPAN = (END - START).days


def day(offset):
    return START + timedelta(days=offset)


def rand_day(lo=0, hi=None):
    return day(RNG.randint(lo, SPAN if hi is None else hi))


def iso(d):
    return d.isoformat() if d else None


def ym(d):
    return d.strftime("%Y-%m") if d else None


def bump(table, key, amount=1):
    if key is None:
        return
    table[key] = table.get(key, 0) + amount


def add_months(d, months):
    m = d.month - 1 + months
    year = d.year + m // 12
    month = m % 12 + 1
    return date(year, month, min(d.day, 28))


# --------------------------------------------------------------------------
# Letters
# --------------------------------------------------------------------------

def build_letters():
    rows = []
    counts = {"issued_p01": 150, "received_p01": 260, "issued_p02": 120, "received_p02": 130,
              "issued_nga": 210, "received_nga": 120}
    for series in LETTER_SERIES:
        key = series["key"]
        codes = CODES[key]
        tag = series["contract"] if series["contract"] != "MAIN" else None
        for i in range(counts[key]):
            code = codes[i % len(codes)]
            if tag:
                ref = "CWL-MEL-%s-%s-%d" % (tag, code, 100 + i)
            else:
                ref = "MEL-NGA-%s-%d" % (code, 100 + i)
            d = rand_day()
            rows.append({
                "no": ref,
                "subj": SUBJECTS[(i * 7 + len(key)) % len(SUBJECTS)],
                "date": iso(d),
                "series": key,
                "code": code,
                "pkg": tag,
            })
    rows.sort(key=lambda r: (r["date"] or "", r["no"]))
    return rows


def aggregate_letters(rows):
    by_series, by_code, by_pkg, by_month, subjects = {}, {}, {}, {}, {}
    dated = 0
    for r in rows:
        s = by_series.setdefault(r["series"], {"count": 0, "first": None, "last": None, "codes": {}})
        s["count"] += 1
        if r["date"]:
            dated += 1
            s["first"] = r["date"] if s["first"] is None or r["date"] < s["first"] else s["first"]
            s["last"] = r["date"] if s["last"] is None or r["date"] > s["last"] else s["last"]
            bump(by_month, r["date"][:7])
        bump(s["codes"], r["code"])
        bump(by_code, r["code"])
        bump(by_pkg, r["pkg"])
        bump(subjects, r["subj"])
    top = sorted(subjects.items(), key=lambda e: (-e[1], e[0]))[:18]
    recent = list(reversed([r for r in rows if r["date"]][-24:]))
    return {
        "total": len(rows),
        "dated": dated,
        "bySeries": by_series,
        "byCode": dict(sorted(by_code.items(), key=lambda e: -e[1])),
        "byPkg": by_pkg,
        "byMonth": dict(sorted(by_month.items())),
        "topSubjects": [{"subj": k, "count": v} for k, v in top],
        "recent": [{"no": r["no"], "subj": r["subj"], "date": r["date"], "series": r["series"]} for r in recent],
    }


# --------------------------------------------------------------------------
# Meetings
# --------------------------------------------------------------------------

def build_meetings():
    rows = []
    for idx, series in enumerate(MEETING_SERIES):
        for i in range(48 if idx == 0 else 40):
            d = add_months(START, i) + timedelta(days=RNG.randint(0, 12))
            if d > END:
                break
            prefix = "MEL-NGA" if idx == 0 else "MEL-CWL"
            rows.append({
                "ref": "%s-WM-%03d-%s" % (prefix, i + 1, d.strftime("%Y%m%d")),
                "date": iso(d),
                "title": "%s-WM-%03d - Weekly Meeting Minutes" % (prefix, i + 1),
                "series": series["key"],
            })
    rows.sort(key=lambda r: (r["date"] or "", r["ref"]))
    return rows


def aggregate_meetings(rows):
    by_series, by_month = {}, {}
    for r in rows:
        s = by_series.setdefault(r["series"], {"count": 0, "first": None, "last": None})
        s["count"] += 1
        if r["date"]:
            s["first"] = r["date"] if s["first"] is None or r["date"] < s["first"] else s["first"]
            s["last"] = r["date"] if s["last"] is None or r["date"] > s["last"] else s["last"]
            bump(by_month, r["date"][:7])
    return {
        "total": len(rows),
        "bySeries": by_series,
        "byMonth": dict(sorted(by_month.items())),
        "recent": list(reversed(rows[-30:])),
        "all": list(reversed(rows)),
        "undated": sum(1 for r in rows if not r["date"]),
    }


# --------------------------------------------------------------------------
# Defects
# --------------------------------------------------------------------------

def build_defects():
    rows = []
    for i in range(180):
        d = rand_day(int(SPAN * 0.55), SPAN)
        status = "Closed" if i % 25 == 0 else "Open"
        rows.append({
            "no": str(i + 1),
            "ref": "NRS-%s-%s-%d" % (RNG.choice(["C", "E"]), RNG.choice(["TT04", "TT06", "TT09"]), i + 1),
            "disc": "C" if i % 6 else "E",
            "loc": DEFECT_LOCATIONS[i % len(DEFECT_LOCATIONS)],
            "desc": DEFECT_DESC[i % len(DEFECT_DESC)],
            "cat": RNG.choice(["A", "B", "C"]),
            "act": "" if status == "Open" else RNG.choice(DEFECT_RESOLVE),
            "target": iso(d),
            "status": status,
            "days": float((d - END).days),
            "prio": RNG.choice(["High", "Medium", "Low", "Medium"]),
        })
    return rows


def aggregate_defects(rows):
    by_status, by_disc, by_grade, by_prio, by_loc, by_month = {}, {}, {}, {}, {}, {}
    overdue = []
    for r in rows:
        bump(by_status, r["status"])
        bump(by_disc, r["disc"])
        bump(by_grade, r["cat"])
        bump(by_prio, r["prio"])
        bump(by_loc, r["loc"])
        bump(by_month, (r["target"] or "")[:7] or None)
        if r["status"] == "Open" and r["days"] < 0:
            overdue.append(r)
    overdue.sort(key=lambda r: r["days"])
    return {
        "total": len(rows),
        "byStatus": by_status,
        "byDiscipline": by_disc,
        "byGrade": by_grade,
        "byPriority": by_prio,
        "byLocation": by_loc,
        "byMonth": dict(sorted(by_month.items())),
        "overdue": overdue[:40],
        "overdueCount": len(overdue),
        "openCount": by_status.get("Open", 0),
    }


# --------------------------------------------------------------------------
# Subcontract certificates
# --------------------------------------------------------------------------

def build_payments():
    ipcs = []
    balance = 0.0
    for i in range(24):
        d = add_months(START, i) + timedelta(days=20)
        if d > END:
            break
        amt = round(RNG.uniform(500000, 1600000), 2)
        vat = round(amt * 0.08, 2)
        sub = round(amt + vat, 2)
        balance += amt
        pay = d + timedelta(days=RNG.randint(10, 70))
        ipcs.append({
            "sn": str(i + 1),
            "date": iso(d),
            "certified": amt,
            "amt": amt,
            "sscl": None,
            "vat": vat,
            "sub": sub,
            "payDate": iso(pay if pay <= END + timedelta(days=40) else None),
            "fxLkr": round(RNG.uniform(1.06, 1.18), 4),
            "fxRmb": None,
            "rmb": None,
            "note": "%dth Interim Payment" % (i + 1),
        })

    employer = []
    for i in range(14):
        d = add_months(START, i * 2) + timedelta(days=14)
        if d > END:
            break
        amt = round(RNG.uniform(2400000, 6200000), 2)
        tax = round(amt * 0.02, 2)
        total = round(amt + tax, 2)
        recv_date = d + timedelta(days=RNG.randint(20, 120))
        employer.append({
            "date": iso(d),
            "no": "TRF%s%03d" % (d.strftime("%Y%m"), i + 1),
            "amt": amt,
            "tax": tax,
            "total": total,
            "fxRmb": None,
            "note": "%dth Interim Payment" % (i + 1),
            "recv": total if i < 12 else 0.0,
            "recvDate": iso(recv_date) if i < 12 else None,
        })

    paid_by, invoiced_by, received_by, emp_invoiced_by = {}, {}, {}, {}
    lags = []
    for r in ipcs:
        bump(invoiced_by, (r["date"] or "")[:7] or None, r["sub"] or 0.0)
        if r["payDate"]:
            bump(paid_by, r["payDate"][:7], r["sub"] or 0.0)
    for r in employer:
        bump(emp_invoiced_by, (r["date"] or "")[:7] or None, r["total"] or 0.0)
        if r["recvDate"]:
            bump(received_by, r["recvDate"][:7], r["recv"] or 0.0)
            lags.append((date.fromisoformat(r["recvDate"]) - date.fromisoformat(r["date"])).days)

    monthly = []
    for i in range(24):
        d = add_months(START, i)
        if d > END:
            break
        monthly.append({"date": iso(d), "usd": round(RNG.uniform(200000, 900000), 2), "lkr": None, "vat": None})

    certified_total = round(sum(r["amt"] for r in ipcs), 2)
    paid_total = round(sum(r["sub"] for r in ipcs if r["payDate"]), 2)
    emp_invoiced = round(sum(r["total"] for r in employer), 2)
    emp_received = round(sum(r["recv"] for r in employer), 2)
    unpaid = [r for r in ipcs if not r["payDate"]]

    lags.sort()
    return {
        "ipcs": ipcs,
        "employer": employer,
        "paidByMonth": dict(sorted(paid_by.items())),
        "invoicedByMonth": dict(sorted(invoiced_by.items())),
        "receivedByMonth": dict(sorted(received_by.items())),
        "employerInvoicedByMonth": dict(sorted(emp_invoiced_by.items())),
        "monthly": monthly,
        "lag": {
            "avg": round(statistics.mean(lags), 1) if lags else None,
            "median": int(statistics.median(lags)) if lags else None,
            "n": len(lags),
            "max": max(lags) if lags else None,
        },
        "fx": [{"date": iso(add_months(START, i * 2)), "lkr": round(RNG.uniform(1.05, 1.19), 4), "rmb": None} for i in range(12)],
        "totals": {
            "certified": certified_total,
            "paid": paid_total,
            "employerInvoiced": emp_invoiced,
            "employerReceived": emp_received,
            "unpaidCount": len(unpaid),
            "unpaidAmount": round(sum(r["amt"] for r in unpaid), 2),
        },
    }


def build_retention(payments):
    out = {}
    for cid, cap in (("P01", 0.05), ("P02", 0.10)):
        rows = [{"ipc": "IPC No.", "period": None, "retThis": None, "retCum": None, "advThis": None, "advCum": None}]
        ret = adv = 0.0
        for i, r in enumerate(payments["ipcs"]):
            this_ret = round((r["amt"] or 0.0) * cap, 2)
            this_adv = round((r["amt"] or 0.0) * 0.10, 2) if i < 10 else 0.0
            ret += this_ret
            adv += this_adv
            rows.append({
                "ipc": "IPC-%02d" % (i + 1),
                "period": r["date"],
                "retThis": this_ret,
                "retCum": round(ret, 2),
                "advThis": this_adv,
                "advCum": round(adv, 2),
            })
        out[cid] = rows
    return out


def build_certificate(payments):
    ipcs = payments["ipcs"]
    last = ipcs[-1]
    items = [
        ("A", "Preliminaries and site establishment", 1400000.0, 0.42),
        ("B", "Earthworks and foundations", 8600000.0, 0.71),
        ("C", "Steel structures and gantries", 12400000.0, 0.55),
        ("D", "Switchgear and protection panels", 21500000.0, 0.38),
        ("E", "Cabling and terminations", 7400000.0, 0.49),
        ("F", "Earthing and lightning protection", 2100000.0, 0.62),
        ("G", "Testing and commissioning", 3600000.0, 0.11),
        ("H", "As-built documentation", 900000.0, 0.05),
    ]
    rows = []
    cumulative = 0.0
    for code, desc, boq, share in items:
        cum = round(boq * share, 2)
        prev = round(cum * 0.94, 2)
        rows.append({
            "code": code,
            "desc": desc,
            "boq": boq,
            "prev": prev,
            "cur": round(cum - prev, 2),
            "cum": cum,
        })
        cumulative += cum
    current = round(sum(r["cur"] for r in rows), 2)
    advance = round(current * 0.08, 2)
    retention = round(current * 0.06, 2)
    return {
        "no": "MEL-CWL-008-IPC-%02d" % len(ipcs),
        "period": last["date"],
        "date": iso(add_months(date.fromisoformat(last["date"]), 1)),
        "items": rows,
        "summary": {
            "previous": round(cumulative - current, 2),
            "current": current,
            "cumulative": round(cumulative, 2),
            "advanceRecovery": advance,
            "retention": retention,
            "netCertified": round(current - advance - retention, 2),
        },
    }


# --------------------------------------------------------------------------
# Main contract certificates
# --------------------------------------------------------------------------

MAIN_CONTRACT = 84000000.0
MAIN_REVISED = 96600000.0
MAIN_ADJUST = MAIN_REVISED - MAIN_CONTRACT
BILLS = [
    ("1", "1.1~1.6 Civil works and foundations", 26500000.0),
    ("2", "2.1~2.8 Primary plant and switchgear", 34800000.0),
    ("3", "3.1~3.5 Control, protection and SCADA", 9800000.0),
    ("4", "4.1~4.3 Spare parts and special tools", 2400000.0),
    ("5", "5.1~5.4 Site management and logistics", 6100000.0),
    ("6", "Provisional sum — mobile transformer", 4000000.0),
    ("7", "Removal and re-erection of existing gantries", 1900000.0),
]


def build_main_contract():
    n = 14
    # The certificate series has to end where the closing statement says the
    # works valuation does, otherwise the table total and the last cumulative
    # disagree and the page looks broken.
    bills = []
    for code, desc, base_lkr in BILLS:
        cum = round(base_lkr * 0.74, 2)
        bills.append({
            "code": code,
            "desc": desc,
            "contractUsd": round(base_lkr / 12.5, 2),
            "contractLkr": base_lkr,
            "curUsd": round(cum / 26, 2),
            "curLkr": round(cum / 6, 2),
            "cumUsd": round(cum / 12.5, 2),
            "cumLkr": cum,
        })
    works = round(sum(b["cumLkr"] for b in bills), 2)

    weights = [RNG.uniform(0.7, 1.25) for _ in range(n)]
    scale = works / sum(weights)
    ipas, ledger, by_period = [], [], {}
    prev = 0.0
    for i in range(n):
        period = add_months(START, i * 2) + timedelta(days=9)
        if period > END:
            break
        cur = round(weights[i] * scale, 2) if i < n - 1 else round(works - prev, 2)
        cum = round(prev + cur, 2)
        ipas.append({
            "prevUsd": round(prev / 12.5, 2),
            "prevLkr": prev,
            "curUsd": round(cur / 12.5, 2),
            "curLkr": cur,
            "cumUsd": round(cum / 12.5, 2),
            "cumLkr": cum,
            "ipa": i + 1,
            "period": iso(period),
            "file": "NGA-MEL-NRS-IPA-%02d.xlsx" % (i + 1),
            "summary": True,
        })
        ledger.append({
            "ipa": i + 1,
            "monthly": cur,
            "cumulative": cum,
            "employerMonth": round(cur * 0.35, 2),
            "employerCum": round(cum * 0.35, 2),
            "contractorMonth": round(cur * 0.42, 2),
            "contractorCum": round(cum * 0.42, 2),
            "nonAdjustable": round(cur * 0.23, 2),
            "remark": "Price adjustment claim" if i % 3 == 0 else "",
        })
        by_period[period.strftime("%Y-%m")] = {"usd": round(cur / 12.5, 2), "lkr": cur}
        prev = cum

    latest = dict(ipas[-1])
    advance = -round(MAIN_CONTRACT * 0.075, 2)
    retention = -round(works * 0.06, 2)
    deductions = -2100000.0
    total = round(works + MAIN_ADJUST + advance + retention + deductions, 2)
    due = round(3450000.0, 2)
    latest.update({
        "grossCumLkr": round(works + MAIN_ADJUST, 2),
        "grossCumUsd": round((works + MAIN_ADJUST) / 12.5, 2),
        "adjustCumLkr": MAIN_ADJUST,
        "adjustCumUsd": round(MAIN_ADJUST / 12.5, 2),
        "totalCumLkr": total,
        "presentCumLkr": total,
        "dueCumLkr": due,
        "retentionCumLkr": retention,
        "advanceRepayCumLkr": advance,
        "advanceCumLkr": -advance,
        "deductionsCumLkr": deductions,
        "retentionLimitCumLkr": round(-retention, 2),
        "bills": bills,
    })

    scans = []
    for i, ordinal in enumerate([3, 5, 6, 8, 9, 11, 12, 14]):
        scans.append({
            "name": "NGA-MEL-NRS-P-%03d %dth Interim Payment.pdf" % (ordinal, ordinal),
            "size": RNG.randint(180000, 4200000),
            "ref": "P-%03d" % ordinal,
            "ordinal": ordinal,
            "issuer": "NGA",
            "amended": i in (4,),
            "enclosure": i in (6,),
            "copies": 1,
        })

    return {
        "folder": "certificates",
        "files": len(ipas) + len(scans),
        "parsed": len(ipas),
        "pdfOnly": [2],
        "missing": [13],
        "ipas": ipas,
        "ledger": ledger,
        "byPeriod": dict(sorted(by_period.items())),
        "latest": latest,
        "scans": scans,
        "contract": {
            "no": "NGA/EPC/2021/07",
            "lkr": MAIN_CONTRACT,
            "usd": 7600000.0,
            "revisedLkr": MAIN_REVISED,
            "originalLkr": MAIN_CONTRACT,
            "originalUsd": 7600000.0,
            "advancePct": 7.5,
            "retentionPct": 6,
        },
        "totals": {
            "certifiedUsd": round(total / 12.5, 2),
            "certifiedLkr": total,
            "count": len(ipas),
            "lastIpa": ipas[-1]["ipa"],
        },
    }


def build_docs():
    return {
        "contracts": [
            {"name": "NGA-MEL main contract — signed.pdf", "size": 3120000, "ext": "pdf"},
            {"name": "MEL-CWL package 1 — signed.pdf", "size": 1840000, "ext": "pdf"},
            {"name": "MEL-CWL package 2 — signed.pdf", "size": 1760000, "ext": "pdf"},
            {"name": "Performance security.pdf", "size": 420000, "ext": "pdf"},
        ],
        "toc": [
            {"name": "NRS - Taking Over Certificate 1 - Reactor Bay.pdf", "size": 512000, "state": "issued"},
            {"name": "NRS - Taking Over Certificate 2 - Control Building.pdf", "size": 498000, "state": "issued"},
            {"name": "NRS - Taking Over Certificate 3 - Gantry A.pdf", "size": 476000, "state": "draft"},
        ],
        "materials": [
            {"name": "NRS01", "files": 4},
            {"name": "NRS02", "files": 2},
            {"name": "NRS03", "files": 7},
        ],
        "media": {"photos": 148, "videos": 2, "pdfLetters": 41},
    }


# --------------------------------------------------------------------------
# Index
# --------------------------------------------------------------------------

def build_index(letters, meetings, defects, payments, main_contract):
    rows = []
    # Column 4 is what each kind needs as a filter: the series for letters and
    # minutes (the scope views filter on it), the discipline and grade for a
    # defect, the contract for a certificate.
    for r in letters:
        rows.append(["L", r["no"], r["date"], r["subj"], r["series"], "letters/%s.md" % r["no"]])
    for r in meetings:
        rows.append(["M", r["ref"], r["date"], r["title"], r["series"], "meetings/%s.md" % r["ref"]])
    for r in defects:
        rows.append(["D", r["ref"], r["target"], r["desc"], r["disc"] + "/" + r["cat"], None])
    for i, r in enumerate(payments["ipcs"]):
        contract = "P01" if i % 2 == 0 else "P02"
        rows.append(["I", "IPC-%02d" % (i + 1), r["date"], "Subcontract certificate %s" % r["amt"], contract,
                     "ipcs/%s.xlsx" % ("P01" if i % 2 == 0 else "P02")])
    for r in main_contract["ipas"]:
        rows.append(["C", "NGA-MEL-IPA-%02d" % r["ipa"], r["period"], "Main contract certified %s" % r["cumLkr"],
                     "MAIN", "certificates/%s" % r["file"]])
    for s in main_contract["scans"]:
        rows.append(["S", s["ref"], None, "Signed certificate scan — %dth Interim Payment" % s["ordinal"],
                     "MAIN", "certificates/%s" % s["name"]])
    return rows


# --------------------------------------------------------------------------

def main():
    letters_raw = build_letters()
    meetings_raw = build_meetings()
    defects_raw = build_defects()
    payments = build_payments()
    main_contract = build_main_contract()

    taxonomy_contracts = []
    for c in CONTRACTS:
        party = next(p for p in PARTIES if p["abbr"] == c["counterparty"])
        taxonomy_contracts.append({
            "id": c["id"], "kind": c["kind"], "no": c["no"], "label": c["label"],
            "counterparty": party["abbr"], "counterpartyName": party["name"],
            "counterpartyRole": party["role"], "roleLabel": "", "currency": PROJECT["currency"],
        })

    project = dict(PROJECT)
    project.update({
        "epcContract": CONTRACTS[1]["no"],
        "p02Contract": CONTRACTS[2]["no"],
        "mainContract": CONTRACTS[0]["no"],
        "mainContractPrice": MAIN_REVISED,
        "p01ContractValue": CONTRACTS[1]["value"],
        "p02ContractValue": CONTRACTS[2]["value"],
    })

    data = {
        "generated": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "project": project,
        "taxonomy": {
            "contracts": taxonomy_contracts,
            "parties": PARTIES,
            "letters": LETTER_SERIES,
            "meetings": MEETING_SERIES,
        },
        "contracts": CONTRACTS,
        "letters": aggregate_letters(letters_raw),
        "meetings": aggregate_meetings(meetings_raw),
        "defects": aggregate_defects(defects_raw),
        "payments": payments,
        "retention": build_retention(payments),
        "certificate": build_certificate(payments),
        "mainContract": main_contract,
        "docs": build_docs(),
        "defectRows": defects_raw[:180],
    }

    index = build_index(letters_raw, meetings_raw, defects_raw, payments, main_contract)

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "workbench.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))

    print("demo dataset: %d letters, %d meetings, %d defects, %d certificates, %d main certificates, %d scans"
          % (data["letters"]["total"], data["meetings"]["total"], data["defects"]["total"],
             len(payments["ipcs"]), len(main_contract["ipas"]), len(main_contract["scans"])))
    print("wrote workbench.json %d B and index.json %d B / %d records"
          % (os.path.getsize(os.path.join(OUT, "workbench.json")),
             os.path.getsize(os.path.join(OUT, "index.json")), len(index)))


if __name__ == "__main__":
    main()
