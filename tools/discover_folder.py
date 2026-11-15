"""Write a workbench config for a project folder the user picked.

    python tools/discover_folder.py <project-folder> <config-out> <dataset-out>

Discovery never guesses: anything it cannot establish from the records is left
blank and reported on the last line as JSON, so the interface can tell the reader
which parts of the page are unsupported rather than filling them with plausible
numbers.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import epc_config


def main(argv):
    if len(argv) < 4:
        sys.stderr.write("usage: discover_folder.py <folder> <config-out> <dataset-out>\n")
        return 2
    folder = os.path.abspath(argv[1])
    cfg_path = os.path.abspath(argv[2])
    out_dir = os.path.abspath(argv[3])
    if not os.path.isdir(folder):
        sys.stderr.write("not a directory: %s\n" % folder)
        return 2

    cfg = epc_config.discover(folder)
    sources = cfg.setdefault("sources", {})
    # The picked folder is the root the extractor resolves every relative source
    # against, and the dataset is written outside the project so reading a folder
    # never changes it.
    sources["root"] = folder
    sources["out"] = out_dir
    os.makedirs(out_dir, exist_ok=True)

    # Two different things arrive as notes: what discovery recognised ('payment
    # register: …', 'main contract number: …') and what it could not find. Only the
    # second is a gap in the page, so the first line says how much of the page rests
    # on records that are actually there. A folder that was read completely must not
    # report four warnings for four successes.
    notes = cfg.get("_notes") or []
    gaps = [n for n in notes if _is_gap(n)]
    found = [n for n in notes if n not in gaps]
    # The config carries only the gaps, because the extractor replays `_notes` into
    # its own warning list: leaving the successes in there would print them twice
    # and under the wrong heading.
    cfg["_notes"] = gaps
    with open(cfg_path, "w", encoding="utf-8") as fh:
        json.dump(cfg, fh, indent=1, ensure_ascii=False)

    for note in notes:
        print("%s: %s" % ("gap" if note in gaps else "found", note))
    print("config: %s" % cfg_path)
    print("NOTES %s" % json.dumps(gaps, ensure_ascii=False))
    print("FOUND %s" % json.dumps(found, ensure_ascii=False))
    return 0


# The wording that marks a note as a gap. Kept as a list of phrases rather than a
# single regex so the two kinds of note stay readable at the place they are written.
_GAP_MARKERS = (
    " were recognised",
    " was recognised",
    "was not found",
    "were not found",
    "nothing matching",
    "is not there",
    "are not there",
    "could not be read",
    "had no",
    "was found and ignored",
    "holds no",
    "is empty",
    "not stated",
    "could not be established",
)


def _is_gap(note):
    low = (note or "").strip().lower()
    if low.startswith("no "):
        # 'no letter series were recognised', 'no payment register workbook was found'
        return True
    return any(marker in low for marker in _GAP_MARKERS)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
