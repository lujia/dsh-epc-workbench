# -*- coding: utf-8 -*-
"""Describe what is actually inside a project folder, for a model to read.

    python tools/inventory.py <folder> <out.json> [--max-bytes N]

The deterministic reader recognises the conventions of one EPC corpus: folders
called `md_Letters_issued_to_…`, a register workbook with an `Interim Payment to
…` sheet, certificates named `…-IPC-52.xlsx`. A folder holding the same records
under other names, in other folders, or with other sheet names defeats it, and
the page comes up empty — which reads to the user as a broken plugin.

This module writes a bounded description of what is on disk: the folder tree with
file counts, the header block of a sample of markdown letters, and the sheet names
plus first rows of a sample of workbooks. A model can then say which folder is
which series and which sheet is which register.

Everything here is capped. A model call has a context window and a corpus of ten
thousand files would fill it many times over, so every sample has a ceiling and
the whole document is truncated against `--max-bytes` with a note saying so. A
truncated description must be recognisable as truncated, otherwise the model
reports the missing half of the corpus as absent.
"""

import json
import os
import sys

import docread
import evidence as evidence_mod

TEXT_EXT = docread.TEXT_EXT
WORD_EXT = docread.WORD_EXT
PDF_EXT = docread.PDF_EXT
DOC_EXT = TEXT_EXT + WORD_EXT + PDF_EXT
SHEET_EXT = (".xlsx", ".xlsm")

# Every ceiling is here rather than inline so a caller can see the whole budget
# at once, and so a test can lower one without rewriting the walker.
MAX_DIRS = 220
MAX_DEPTH = 4
MAX_MARKDOWN = 14
MAX_MARKDOWN_LINES = 16
MAX_LINE_CHARS = 220
MAX_WORKBOOKS = 14
MAX_SHEETS = 8
MAX_SHEET_ROWS = 10
MAX_SHEET_COLS = 9
MAX_CELL_CHARS = 48
MAX_NAME_CHARS = 120


def _open(path):
    try:
        from openpyxl import load_workbook
    except Exception:
        return None
    try:
        return load_workbook(path, read_only=True, data_only=True)
    except Exception:
        return None


def _cell(value):
    text = "" if value is None else str(value)
    text = " ".join(text.split())
    return text[:MAX_CELL_CHARS]


def _walk(folder):
    """Every file under `folder`, breadth first, capped in depth and count."""
    files = []
    dirs = []
    queue = [(folder, 0)]
    seen = 0
    while queue:
        current, depth = queue.pop(0)
        if depth > MAX_DEPTH:
            continue
        try:
            names = sorted(os.listdir(current))
        except OSError:
            continue
        for name in names:
            if name.startswith(".") or name.startswith("~$"):
                continue
            path = os.path.join(current, name)
            try:
                is_dir = os.path.isdir(path)
            except OSError:
                continue
            if is_dir:
                dirs.append((path, depth + 1))
                queue.append((path, depth + 1))
            else:
                files.append(path)
                seen += 1
                if seen > 40000:
                    return files, dirs, True
    return files, dirs, False


def _ext(name):
    return os.path.splitext(name)[1].lower()


def _dir_entry(folder, path, depth):
    counts = {}
    names = []
    try:
        entries = sorted(os.listdir(path))
    except OSError:
        entries = []
    for name in entries:
        if name.startswith(".") or name.startswith("~$"):
            continue
        full = os.path.join(path, name)
        if os.path.isdir(full):
            continue
        ext = _ext(name) or "(none)"
        counts[ext] = counts.get(ext, 0) + 1
        if len(names) < 6:
            names.append(name[:MAX_NAME_CHARS])
    return {
        "path": os.path.relpath(path, folder).replace("\\", "/"),
        "depth": depth,
        "files": sum(counts.values()),
        "byExt": counts,
        "samples": names,
    }


def _size(path):
    try:
        return os.path.getsize(path)
    except OSError:
        return 0


def _markdown(path):
    """The header block of one document, which is where its identity is.

    Named for the markdown letters it was written for, but it now serves any
    document: a `.docx` letter and a PDF with a text layer carry the same
    `Reference:`, `Date:` and subject lines, and a model reading the folder needs
    to see them or it can only judge the corpus by its file names.
    """
    lines = docread.head_lines(path, MAX_MARKDOWN_LINES, MAX_LINE_CHARS, 6000)
    if not lines:
        return None
    return lines


def _evidence(path):
    """The priced terms of one document, wherever in it they were printed.

    A letter states its identity in the first two lines; a contract states its
    price on page three, its parties in a preamble, its retention elsewhere. The
    header block above is the right sample for the first and useless for the
    second, so a long document is also scanned end to end for amounts, parties,
    priced terms and reference numbers — and only those passages are sent, which
    keeps an 800 KB contract inside the same budget as a one-page letter.
    """
    try:
        found = evidence_mod.evidence(path)
    except Exception:
        return None
    if not any(found.get(k) for k in ("money", "terms", "parties", "references")):
        return None
    return found


def _sheet_preview(ws):
    rows = []
    width = 0
    try:
        for row in ws.iter_rows(min_row=1, max_row=MAX_SHEET_ROWS * 3, max_col=MAX_SHEET_COLS, values_only=True):
            cells = [_cell(v) for v in row]
            while cells and cells[-1] == "":
                cells.pop()
            if not cells:
                continue
            rows.append(cells)
            width = max(width, len(cells))
            if len(rows) >= MAX_SHEET_ROWS:
                break
    except Exception:
        pass
    return rows, width


def _workbook(path, folder):
    wb = _open(path)
    if wb is None:
        return {"path": os.path.relpath(path, folder).replace("\\", "/"), "error": "could not be read"}
    out = {"path": os.path.relpath(path, folder).replace("\\", "/"), "sheets": []}
    try:
        names = list(wb.sheetnames)[:MAX_SHEETS]
    except Exception:
        names = []
    for name in names:
        try:
            ws = wb[name]
            rows, width = _sheet_preview(ws)
            out["sheets"].append({
                "name": name[:MAX_NAME_CHARS],
                "rows": getattr(ws, "max_row", None),
                "cols": getattr(ws, "max_column", None) or width,
                "sample": rows,
            })
        except Exception:
            out["sheets"].append({"name": str(name)[:MAX_NAME_CHARS], "error": "could not be read"})
    try:
        wb.close()
    except Exception:
        pass
    return out


def subfolders(folder):
    """The immediate subfolders of a project folder, which is what gets read one by one.

    A project is organised by subject — contracts, defects, drawings, letters — and
    the model is asked about one of them at a time. Asking about all ten at once
    means a single answer covering a thousand files, and the answer degrades exactly
    where the folder is largest. Naming them here also keeps the split visible to the
    caller, which reports progress folder by folder.
    """
    out = []
    try:
        names = sorted(os.listdir(folder))
    except OSError:
        return out
    for name in names:
        if name.startswith(".") or name.startswith("~$"):
            continue
        full = os.path.join(folder, name)
        if os.path.isdir(full):
            out.append(name)
    return out


def inventory(folder):
    folder = os.path.abspath(folder)
    files, dirs, truncated = _walk(folder)
    by_ext = {}
    for path in files:
        ext = _ext(path) or "(none)"
        by_ext[ext] = by_ext.get(ext, 0) + 1

    # One directory per line, biggest first: a model reading a tree wants the
    # folders that hold records, not an alphabetical listing of everything.
    entries = []
    for path, depth in [(folder, 0)] + dirs[:MAX_DIRS]:
        entries.append(_dir_entry(folder, path, depth))
    entries.sort(key=lambda e: (-e["files"], e["path"]))
    if len(entries) > MAX_DIRS:
        entries = entries[:MAX_DIRS]

    document_paths = [p for p in files if _ext(p) in DOC_EXT]
    # Spread the sample over the folders first and the formats second. A corpus
    # keeps its letters as markdown in one tree and its certificates as PDFs in
    # another; draining one folder at a time fills every slot with the first tree
    # met and never shows the model a single scan — and the scans are exactly what
    # it has to be told about when the reader could not parse them. So each pass
    # takes one document from every folder, preferring a format the sample has not
    # covered yet.
    by_folder = {}
    for path in document_paths:
        by_folder.setdefault(os.path.dirname(path), {}).setdefault(_ext(path), []).append(path)
    # Largest first inside each folder: in a folder of contract documents the
    # agreement itself is the big one and the addenda are small, and the agreement
    # is what states the price. Alphabetical order picked `C008-Addendum-01.md`
    # fourteen times out of fourteen on a contracts-only corpus and never showed
    # the model a single contract.
    for buckets in by_folder.values():
        for ext in buckets:
            buckets[ext].sort(key=lambda p: (-_size(p), os.path.basename(p)))
    folders = sorted(by_folder, key=lambda d: -sum(len(b) for b in by_folder[d].values()))
    seen_ext = {}
    sample = []
    while len(sample) < MAX_MARKDOWN and folders:
        progressed = False
        for folder_key in folders:
            if len(sample) >= MAX_MARKDOWN:
                break
            buckets = by_folder[folder_key]
            live = [e for e in buckets if buckets[e]]
            if not live:
                continue
            # fewest samples so far wins, so a corpus of 8000 markdown letters and
            # 40 scanned PDFs still describes both
            live.sort(key=lambda e: (seen_ext.get(e, 0), e))
            chosen = live[0]
            sample.append(buckets[chosen].pop(0))
            seen_ext[chosen] = seen_ext.get(chosen, 0) + 1
            progressed = True
        if not progressed:
            break
    markdown = []
    for path in sample:
        lines = _markdown(path)
        entry = {"path": os.path.relpath(path, folder).replace("\\", "/")}
        if lines is None:
            # A scanned page has no text layer. Saying so is the honest answer,
            # and it is also information: a folder of such files is a folder of
            # images, which is why the reader cannot parse it.
            entry["note"] = "no text layer"
            entry["lines"] = []
        else:
            entry["lines"] = lines
        found = _evidence(path)
        if found is not None:
            entry["evidence"] = found
        markdown.append(entry)

    sheet_paths = [p for p in files if _ext(p) in SHEET_EXT]
    # Newest-looking names first is a guess; a stable order is more honest, so
    # take one workbook per folder and then fill in, which covers one register
    # per folder instead of ten certificates from the same one.
    workbooks = []
    per_folder = {}
    for path in sheet_paths:
        per_folder.setdefault(os.path.dirname(path), []).append(path)
    picked = []
    while len(picked) < MAX_WORKBOOKS and per_folder:
        for key in list(per_folder):
            bucket = per_folder[key]
            if not bucket:
                del per_folder[key]
                continue
            picked.append(bucket.pop(0))
            if len(picked) >= MAX_WORKBOOKS:
                break
    for path in picked:
        workbooks.append(_workbook(path, folder))

    return {
        "folder": folder,
        "name": os.path.basename(folder),
        "subfolders": subfolders(folder),
        "truncated": truncated,
        "counts": {
            "files": len(files),
            "dirs": len(dirs),
            "byExt": by_ext,
            "markdownSampled": len(markdown),
            "markdownTotal": len(document_paths),
            "workbooksSampled": len(workbooks),
            "workbooksTotal": len(sheet_paths),
        },
        "dirs": entries,
        "markdown": markdown,
        "workbooks": workbooks,
    }


def _shrink(doc, limit):
    """Drop samples until the document fits, saying what was dropped."""
    dropped = []
    while len(json.dumps(doc, ensure_ascii=False)) > limit:
        if doc["workbooks"]:
            doc["workbooks"].pop()
            dropped.append("workbook samples")
        elif doc["markdown"]:
            doc["markdown"].pop()
            dropped.append("letter samples")
        elif len(doc["dirs"]) > 40:
            doc["dirs"].pop()
            dropped.append("folders")
        else:
            break
    if dropped:
        doc["truncated"] = True
        doc["dropped"] = sorted(set(dropped))
    return doc


def main(argv):
    if len(argv) < 3:
        sys.stderr.write("usage: inventory.py <folder> <out.json> [--max-bytes N] [--list]\n")
        return 2
    folder = os.path.abspath(argv[1])
    out = os.path.abspath(argv[2])
    limit = 160000
    if "--max-bytes" in argv:
        try:
            limit = int(argv[argv.index("--max-bytes") + 1])
        except (IndexError, ValueError):
            pass
    if not os.path.isdir(folder):
        sys.stderr.write("not a directory: %s\n" % folder)
        return 2
    if "--list" in argv:
        # One line per immediate subfolder. The caller reads the folder one subject
        # at a time and needs the list before it starts, without paying for a full
        # inventory of a tree it is about to walk itself.
        for name in subfolders(folder):
            print(name)
        return 0
    doc = _shrink(inventory(folder), limit)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
    print("inventory: %d files, %d folders, %d letter samples, %d workbook samples%s"
          % (doc["counts"]["files"], doc["counts"]["dirs"], len(doc["markdown"]),
             len(doc["workbooks"]), " (truncated)" if doc["truncated"] else ""))
    print("WROTE %s %d" % (out, os.path.getsize(out)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
