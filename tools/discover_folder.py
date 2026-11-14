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
    with open(cfg_path, "w", encoding="utf-8") as fh:
        json.dump(cfg, fh, indent=1, ensure_ascii=False)

    notes = cfg.get("_notes") or []
    for note in notes:
        print("note: %s" % note)
    print("config: %s" % cfg_path)
    print("NOTES %s" % json.dumps(notes, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
