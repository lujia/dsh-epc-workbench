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


def merge_folders(folder, demo, origins):
    """One listing per subject folder, each from whichever side actually holds it.

    A project organised by subject folders usually has some of them empty — a
    project with no photographs yet still has a photographs page, and that page is
    how a reader learns there are none. Showing the demo's four photographs there
    would be a lie about this project, so an EMPTY folder becomes an empty page.

    The demo stands in only for the folders the folder page was never pointed at at
    all, which is the case where the payload has no entry for the key: a project
    that predates the folder pages, or one where discovery found no such folder. The
    difference between 'this folder is empty' and 'this project has no such folder'
    is the whole point of the page, so the two are not collapsed.
    """
    own = (folder or {}).get("folders") or {}
    theirs = (demo or {}).get("folders") or {}
    if not own and not theirs:
        return None
    out = {}
    for key in set(list(own.keys()) + list(theirs.keys())):
        mine = own.get(key)
        if mine is not None:
            out[key] = mine
            continue
        out[key] = theirs.get(key)
        origins["folders." + key] = "demo"
    return out


def _kind_order(contracts):
    """Contract ids by kind, in register order: two mains, two subs, and so on."""
    out = {}
    for c in contracts or []:
        out.setdefault(str(c.get("kind") or ""), []).append(str(c.get("id") or ""))
    return out


def _series_remap(demo_contracts, contracts):
    """Which id a demo series must point at once the register is the folder's.

    A series carries the contract it belongs to, and a substituted letters section
    brings the demo's series keys with it. If the register is the folder's, those
    ids name contracts the page no longer has, and every letter row is filtered out
    by a scope it cannot match. Contracts are matched by kind and order, because
    that is what survives a rename: the first subcontract is the first subcontract
    whatever it is called.
    """
    demo_by_kind = _kind_order(demo_contracts)
    now_by_kind = _kind_order(contracts)
    remap = {}
    for kind, ids in demo_by_kind.items():
        mine = now_by_kind.get(kind) or []
        for index, old in enumerate(ids):
            if index < len(mine):
                remap[old] = mine[index]
            elif mine:
                remap[old] = mine[-1]
    return remap


def merge_taxonomy(folder, demo, origins, contracts=None):
    """The vocabulary for a page whose sections do not all come from one place.

    Every id the interface joins on has to resolve, and the series labels come from
    here. A substituted SECTION brings its own records but not its own vocabulary:
    a folder that holds contracts but no letters gets the demo's nine hundred and
    ninety letters with no label at all unless this runs, and a folder that holds
    letters but no contracts keeps eight real letters on a page whose register is
    the demo's. So the contracts and parties are whatever the register is, and the
    series are the folder's own where the folder has them, re-pointed at the main
    contract; only a section that came from the demo contributes the demo's series.
    """
    demo_tax = (demo or {}).get("taxonomy") or {}
    folder_tax = (folder or {}).get("taxonomy") or {}
    contracts = contracts if contracts is not None else (folder_tax.get("contracts") or [])
    remap = _series_remap(demo_tax.get("contracts") or [], contracts)
    main_id = None
    for c in contracts:
        if c.get("kind") == "main":
            main_id = c.get("id")
            break
    out = {
        "contracts": contracts or [],
        "parties": folder_tax.get("parties") or (demo_tax.get("parties") or []),
        "letters": [],
        "meetings": [],
    }
    if origins.get("letters") == "folder":
        for entry in (folder_tax.get("letters") or []):
            item = dict(entry)
            item["contract"] = main_id or item.get("contract")
            out["letters"].append(item)
    else:
        for entry in (demo_tax.get("letters") or []):
            item = dict(entry)
            item["contract"] = remap.get(str(item.get("contract") or ""), main_id)
            out["letters"].append(item)
    if origins.get("meetings") == "folder":
        for entry in (folder_tax.get("meetings") or []):
            item = dict(entry)
            item["contract"] = main_id or item.get("contract")
            out["meetings"].append(item)
    else:
        for entry in (demo_tax.get("meetings") or []):
            item = dict(entry)
            item["contract"] = remap.get(str(item.get("contract") or ""), main_id)
            out["meetings"].append(item)
    return out


def restate_records(contracts, data):
    """The counts the register strip prints, recounted from what the page shows.

    The register's own counters are the folder's: a contracts-only folder certifies
    nothing, so every contract reads zero, while the page beside it lists nine
    hundred and ninety letters because that section came from the demo. A strip that
    says '0 letters' next to a list of 990 is the kind of contradiction that makes a
    reader stop trusting every other figure too.
    """
    tax = (data.get("taxonomy") or {})
    letters = data.get("letters") or {}
    meetings = data.get("meetings") or {}
    certs_main = ((data.get("mainContract") or {}).get("totals") or {}).get("count") or 0
    by_series = letters.get("bySeries") or {}
    by_meeting = meetings.get("bySeries") or {}
    per_letter = {}
    per_meeting = {}
    for entry in (tax.get("letters") or []):
        cid = str(entry.get("contract") or "")
        count = (by_series.get(entry.get("key")) or {}).get("count") or 0
        per_letter[cid] = per_letter.get(cid, 0) + count
    for entry in (tax.get("meetings") or []):
        cid = str(entry.get("contract") or "")
        count = (by_meeting.get(entry.get("key")) or {}).get("count") or 0
        per_meeting[cid] = per_meeting.get(cid, 0) + count
    retention = data.get("retention") or {}
    out = []
    for c in contracts or []:
        row = dict(c)
        cid = str(row.get("id") or "")
        if row.get("kind") == "main":
            row["records"] = certs_main
        else:
            rows = retention.get(cid) or []
            row["records"] = len([r for r in rows if r.get("ipc")])
        # Two counters, because the register tile prints them as two numbers and a
        # meeting counted as a letter would make the tile disagree with the
        # correspondence page that lists the letters.
        row["letters"] = per_letter.get(cid, 0)
        row["meetings"] = per_meeting.get(cid, 0)
        out.append(row)
    return out


def stated_contract(contract):
    """A price the documents state, as opposed to a block the extractor shaped.

    The main contract's card is filled from the configuration, so it exists as an
    object even when the folder stated no price at all — an object whose every
    figure is null. That is the case the demo has to stand in for; a stated price
    is the case it must not overwrite.
    """
    if not contract:
        return False
    for key in ("lkr", "usd", "revisedLkr", "originalLkr"):
        value = contract.get(key)
        if isinstance(value, (int, float)) and value > 0:
            return True
    return False


def merge(folder, demo, fill=True):
    """One payload: every section the folder filled, and what it did not.

    ``fill`` decides what happens to a section the folder never provided. The demo
    stands in only when the workbench is *demonstrating itself*, which is the first
    run and the Use demo data button. A folder that was actually read does not have
    the demo spliced into it: the reader asked what this project holds, and a
    section the folder does not carry is a blank section, not somebody else's
    records. A blank page also says which part is missing and can be filled in
    later, whereas a page carrying another project's defects cannot be told apart
    from one that was read correctly.
    """
    out = dict(folder)
    have = sections_of(folder)
    origins = {}
    for name, present in have.items():
        if present:
            origins[name] = "folder"
        elif fill and demo is not None and name in demo:
            out[name] = demo.get(name)
            origins[name] = "demo"
        else:
            origins[name] = "empty"

    # The row list the tables read from is part of the defect section.
    if origins.get("defects") == "demo" and demo is not None:
        out["defectRows"] = demo.get("defectRows") or []

    # The main-contract section is two things: the price the contract was let at,
    # and the certificates measured against it. A folder of contract documents
    # states the first and holds none of the second, and the certificate series is
    # one unbroken run — a demonstration certificate numbered IPA 14 beside a real
    # contract number reads as a claim that this project has been certified fourteen
    # times. So the price block travels with the folder and the certificates stay
    # the demo's, where the strip's demo chip already says so.
    folder_contract = ((folder.get("mainContract") or {}).get("contract")) or {}
    if origins.get("mainContract") == "demo" and stated_contract(folder_contract):
        out["mainContract"] = dict(out.get("mainContract") or {})
        out["mainContract"]["contract"] = folder_contract

    # The register, the currency table and the labels come from the contract
    # section: a project whose packages were never found has no register of its
    # own, and an empty scope switcher would blank every other page. The identity
    # goes with it, and it has to go WHOLE — half a demo caption over a folder's
    # party codes is the worst of both, a page that names one project and prices
    # another. So when the register is the demo's, the names, the parties, the
    # numbers and the values are all the demo's.
    #
    # The vocabulary, though, is rebuilt in EVERY merge, not only when the register
    # came from the demo: a contracts-only folder has a register of its own and no
    # letter series at all, and the demo's nine hundred and ninety letters would
    # then appear on the page with no label and no scope to belong to.
    if demo is not None and (fill or not have.get("letters")):
        out["taxonomy"] = merge_taxonomy(folder, demo, origins, out.get("contracts") or [])

    if not have.get("contracts") and fill and demo is not None:
        out["contracts"] = demo.get("contracts") or []
        if not (out.get("currencies") or []):
            out["currencies"] = demo.get("currencies") or []
        demo_project = demo.get("project") or {}
        project = dict(demo_project)
        project.update({k: v for k, v in (out.get("project") or {}).items()
                        if k in ("currencies",) and v})
        out["project"] = project
        origins["project"] = "demo"

    merged_folders = merge_folders(folder, demo if fill else None, origins)
    if merged_folders is not None:
        out["folders"] = merged_folders

    out["origins"] = origins
    out["demoSections"] = [k for k, v in origins.items() if v == "demo"]
    out["folderSections"] = [k for k, v in origins.items() if v == "folder"]
    out["contracts"] = restate_records(out.get("contracts") or [], out)
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
    if len(argv) < 4:
        sys.stderr.write("usage: merge_dataset.py <folder workbench.json> <demo workbench.json> <out dir> [--blank]\n")
        return 2
    folder_path, demo_path, out_dir = argv[1], argv[2], argv[3]
    # --blank keeps a section the folder did not provide empty instead of standing
    # the demo in for it. That is what a real read does: a blank section is a fact
    # about this folder, and it can be filled in later by adding the records.
    fill = "--blank" not in argv[4:]
    folder = _load(folder_path)
    if folder is None:
        sys.stderr.write("the folder dataset could not be read: %s\n" % folder_path)
        return 2
    demo = _load(demo_path)
    merged = merge(folder, demo, fill=fill)
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
    print("blank sections: %s" % (", ".join(k for k, v in merged["origins"].items() if v == "empty") or "none"))
    print("WROTE %s %d" % (data_path, os.path.getsize(data_path)))
    print("WROTE %s %d %d records" % (index_path, os.path.getsize(index_path), len(rows)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
