# -*- coding: utf-8 -*-
"""Fill the gaps in a read folder with the bundled demo dataset.

A reader that has to turn a half-organised folder into a page has three options,
and only one of them is honest:

* refuse the folder, which is what 'could not read that folder' did, and leaves
  the user with nothing after waiting for a build;
* print empty cards, which looks like a project with no letters rather than a
  folder with no letters in it;
* show what the folder does hold, and say which sections are standing in from
  the demo data.

This script does the third. It never invents a value and never mixes two
sections: a section is either entirely from the folder or entirely from the
demo, and the payload records which, so the interface can label it.

    python tools/merge_dataset.py <folder workbench.json> <demo workbench.json> <out dir>
"""

import io
import json
import os
import sys


# section name -> the index kinds it contributes. The index is rebuilt from
# these so a substituted section cannot leave the previous project's rows behind.
SECTION_KINDS = {
    "letters": ("L",),
    "meetings": ("M",),
    "defects": ("D",),
    "payments": ("I",),
    "mainContract": ("C",),
    "certificate": ("S",),
}


def _load(path):
    try:
        with io.open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def _count(value):
    if isinstance(value, list):
        return len([x for x in value if x])
    if isinstance(value, dict):
        return len([k for k, v in value.items() if v])
    return 1 if value else 0


def has_letters(data):
    letters = data.get("letters") or {}
    return (letters.get("total") or 0) > 0


def has_meetings(data):
    meetings = data.get("meetings") or {}
    return (meetings.get("total") or 0) > 0


def has_defects(data):
    defects = data.get("defects") or {}
    return (defects.get("total") or 0) > 0


def has_payments(data):
    payments = data.get("payments") or {}
    if (payments.get("ipcs") or []):
        return True
    if (payments.get("employer") or []):
        return True
    totals = payments.get("totals") or {}
    return bool(totals.get("certified"))


def has_retention(data):
    retention = data.get("retention") or {}
    # The first row of a retention sheet is its header; a sheet that was read but
    # held no certificate still holds that one row.
    return any(_count(rows) > 1 for rows in retention.values())


def has_certificate(data):
    cert = data.get("certificate") or {}
    return bool(cert.get("items"))


def has_main_contract(data):
    main = data.get("mainContract")
    if not main:
        return False
    return bool(main.get("ipas") or main.get("ledger") or main.get("scans"))


def has_docs(data):
    docs = data.get("docs") or {}
    media = docs.get("media") or {}
    items = (docs.get("contracts") or []) + (docs.get("toc") or []) + (docs.get("materials") or [])
    return bool(items) or bool(media.get("photos") or media.get("videos") or media.get("pdfLetters"))


def has_contracts(data):
    """A contract number that was actually read, rather than one invented for the page.

    `normalise()` fills a missing contract number with the contract id, so a folder
    that held no contract at all still arrives with a `MAIN` entry whose number is
    the string 'MAIN'. Treating that as evidence would keep the placeholder register
    while the payments and certificates beside it come from the demo.
    """
    for contract in data.get("contracts") or []:
        number = (contract.get("no") or "").strip()
        ident = (contract.get("id") or "").strip()
        if number and number != ident and number.lower() != "main contract":
            return True
    return False


PRESENCE = {
    "contracts": has_contracts,
    "letters": has_letters,
    "meetings": has_meetings,
    "defects": has_defects,
    "payments": has_payments,
    "retention": has_retention,
    "certificate": has_certificate,
    "mainContract": has_main_contract,
    "docs": has_docs,
}


def sections_of(data):
    return {name: bool(test(data)) for name, test in PRESENCE.items()}


def merge_taxonomy(folder, demo, origins):
    """The vocabulary for a page whose contracts came from the demo.

    The contracts, the parties and the currency table have to be the demo's — the
    register is the demo's, so every id the interface joins on is the demo's. The
    SERIES are not: they are the folder's own, and dropping them would leave eight
    real letters and one real minute book on the page with no label and no scope
    to belong to, while the demo's five hundred letters appear under a caption
    that names them. So the folder's series travel, re-pointed at the main
    contract, and only the demo's series are added where the folder has none.
    """
    demo_tax = (demo or {}).get("taxonomy") or {}
    folder_tax = (folder or {}).get("taxonomy") or {}
    main_id = None
    for c in (demo_tax.get("contracts") or []):
        if c.get("kind") == "main":
            main_id = c.get("id")
            break
    out = {
        "contracts": demo_tax.get("contracts") or [],
        "parties": demo_tax.get("parties") or [],
        "letters": [],
        "meetings": [],
    }
    if origins.get("letters") == "folder":
        for entry in (folder_tax.get("letters") or []):
            item = dict(entry)
            item["contract"] = main_id or item.get("contract")
            out["letters"].append(item)
    else:
        out["letters"] = list(demo_tax.get("letters") or [])
    if origins.get("meetings") == "folder":
        for entry in (folder_tax.get("meetings") or []):
            item = dict(entry)
            item["contract"] = main_id or item.get("contract")
            out["meetings"].append(item)
    else:
        out["meetings"] = list(demo_tax.get("meetings") or [])
    return out


def merge(folder, demo):
    """One payload: every section the folder filled, the rest from the demo."""
    out = dict(folder)
    have = sections_of(folder)
    origins = {}
    for name, present in have.items():
        if present:
            origins[name] = "folder"
        elif demo is not None and name in demo:
            out[name] = demo.get(name)
            origins[name] = "demo"
        else:
            origins[name] = "empty"

    # The row list the tables read from is part of the defect section.
    if origins.get("defects") == "demo" and demo is not None:
        out["defectRows"] = demo.get("defectRows") or []

    # The register, the currency table and the labels come from the contract
    # section: a project whose packages were never found has no register of its
    # own, and an empty scope switcher would blank every other page. The identity
    # goes with it, and it has to go WHOLE — half a demo caption over a folder's
    # party codes is the worst of both, a page that names one project and prices
    # another. So when the register is the demo's, the names, the parties, the
    # numbers and the values are all the demo's.
    if not have.get("contracts") and demo is not None:
        out["contracts"] = demo.get("contracts") or []
        out["taxonomy"] = merge_taxonomy(folder, demo, origins)
        if not (out.get("currencies") or []):
            out["currencies"] = demo.get("currencies") or []
        demo_project = demo.get("project") or {}
        project = dict(demo_project)
        project.update({k: v for k, v in (out.get("project") or {}).items()
                        if k in ("currencies",) and v})
        out["project"] = project
        origins["project"] = "demo"

    out["origins"] = origins
    out["demoSections"] = [k for k, v in origins.items() if v == "demo"]
    out["folderSections"] = [k for k, v in origins.items() if v == "folder"]
    return out


def rebuild_index(folder_index, demo_index, data):
    """Rows for the merged payload.

    A substituted section must not leave the folder's rows beside the demo's:
    the search palette and the tables would then disagree about what the project
    holds.
    """
    origins = data.get("origins") or {}
    kinds = {}
    for section, section_kinds in SECTION_KINDS.items():
        origin = origins.get(section)
        for kind in section_kinds:
            if kind in kinds and kinds[kind] != origin:
                # Two sections can feed one kind (certificate and docs scans). The
                # folder wins if either source is real, because a real row is a
                # statement about this project.
                kinds[kind] = "folder" if "folder" in (kinds[kind], origin) else origin
            else:
                kinds[kind] = origin
    out = []
    for row in folder_index or []:
        kind = row[0] if row else None
        if kinds.get(kind) == "demo":
            continue
        out.append(row)
    # The folder's own rows are kept exactly as the extractor wrote them. Two
    # letters can carry the same reference on the same day, and a defect list can
    # hold the same location twice; collapsing those would delete real records and
    # make the row count on the statusbar disagree with the tables.
    seen = set()
    for row in demo_index or []:
        kind = row[0] if row else None
        if kinds.get(kind) != "demo":
            continue
        key = (row[0], row[1], row[2])
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def main(argv):
    if len(argv) != 4:
        sys.stderr.write("usage: merge_dataset.py <folder workbench.json> <demo workbench.json> <out dir>\n")
        return 2
    folder_path, demo_path, out_dir = argv[1], argv[2], argv[3]
    folder = _load(folder_path)
    if folder is None:
        sys.stderr.write("the folder dataset could not be read: %s\n" % folder_path)
        return 2
    demo = _load(demo_path)
    merged = merge(folder, demo)
    os.makedirs(out_dir, exist_ok=True)
    data_path = os.path.join(out_dir, "workbench.json")
    with io.open(data_path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(merged, fh, ensure_ascii=False, separators=(",", ":"), allow_nan=False)

    index_path = os.path.join(out_dir, "index.json")
    folder_index = _load(os.path.join(os.path.dirname(folder_path), "index.json")) or []
    demo_index = _load(os.path.join(os.path.dirname(demo_path), "index.json")) or []
    rows = rebuild_index(folder_index, demo_index, merged)
    with io.open(index_path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(rows, fh, ensure_ascii=False, separators=(",", ":"))

    print("merged sections: %s" % (", ".join("%s=%s" % (k, v) for k, v in merged["origins"].items())))
    print("demo sections: %s" % (", ".join(merged["demoSections"]) or "none"))
    print("WROTE %s %d" % (data_path, os.path.getsize(data_path)))
    print("WROTE %s %d %d records" % (index_path, os.path.getsize(index_path), len(rows)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
