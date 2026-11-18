# -*- coding: utf-8 -*-
"""Merge a model's reading of a folder into the deterministic reader's answer.

    python tools/merge_config.py <discovered.json> <analysed.json> <out.json>

'Choose folder' reads a folder whose records follow the conventions the extractor
knows. 'Analyze with model' is for a folder that does not: the model is shown a
bounded description of it and says what it holds. Both answers describe the same
configuration, and the assisted path must not throw away what the deterministic
one parsed out of the files — the model read a summary, the reader read the
workbooks. So discovery's values win wherever discovery has one, and the model
fills the rest.

Prints one `merged: <n> field(s) taken from the model` line so the host can say
whether the model actually contributed anything.
"""

import json
import sys

import epc_config


def main(argv):
    if len(argv) < 4:
        sys.stderr.write("usage: merge_config.py <discovered> <analysed> <out>\n")
        return 2
    with open(argv[1], encoding="utf-8") as fh:
        discovered = epc_config.normalise(json.load(fh))
    analysed = None
    try:
        with open(argv[2], encoding="utf-8") as fh:
            analysed = epc_config.normalise(json.load(fh))
    except (OSError, ValueError):
        analysed = None

    if analysed is None:
        out = discovered
        print("merged: 0 field(s) taken from the model")
    else:
        out = epc_config.merge(discovered, analysed)
        taken = _count_taken(discovered, out)
        print("merged: %d field(s) taken from the model" % taken)

    # Written back in the same flat shape discovery uses, because that is what
    # build_data.py loads: it normalises again on the way in, so writing the
    # normalised form here would nest `main`/`subs` where the loader does not
    # look for them.
    with open(argv[3], "w", encoding="utf-8") as fh:
        json.dump(_flatten(out), fh, indent=1, ensure_ascii=False)
    print("WROTE %s" % argv[3])
    return 0


def _flatten(cfg):
    """The configuration as a file, without the derived `main`/`subs` views."""
    out = dict(cfg)
    out.pop("main", None)
    out.pop("subs", None)
    # Both spellings are live: `notes` is what normalise() returns, `_notes` is
    # what the merge carries over, and dropping either loses a repair the page
    # is supposed to report.
    merged = list(cfg.get("notes") or [])
    for note in cfg.get("_notes") or []:
        if note not in merged:
            merged.append(note)
    out.pop("notes", None)
    out["_notes"] = merged
    return out


def _count_taken(before, after):
    """How many top-level facts the merge added — a number worth reporting."""
    count = 0
    for key in ("project", "sources", "main"):
        a = before.get(key) or {}
        b = after.get(key) or {}
        for field, value in b.items():
            if value not in (None, "", [], {}) and a.get(field) in (None, "", [], {}):
                count += 1
    for key in ("parties", "contracts", "letters", "meetings"):
        count += max(0, len(after.get(key) or []) - len(before.get(key) or []))
    return count


if __name__ == "__main__":
    sys.exit(main(sys.argv))
