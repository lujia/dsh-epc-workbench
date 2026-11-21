# -*- coding: utf-8 -*-
"""The passages of a document that state facts, for a model to read.

    import evidence; evidence.evidence(path)

A folder of contracts is not a folder of letters. A letter carries its identity in a
header block — reference, date, subject — and the inventory that feeds the model
reads exactly that block. A contract carries its identity in the middle of eight
hundred kilobytes: the price is on page three, the retention percentage is somewhere
in the conditions, and the parties are named once in the preamble and then referred to
as "the Contractor" for two hundred pages.

An inventory built from head lines therefore describes a contract folder as a list of
file names — and a corpus that holds nothing but contracts produced a page with no
prices on it.

So this module reads the whole document (bounded) and returns the passages that carry
a fact: lines with an amount, the preamble that names the parties, lines that state a
term the workbench prices against, and the heading structure so the model can tell a
main contract from an addendum. Passages are ranked, not merely collected: a line
that says "contract price" is worth more than a line that happens to contain a
number, and a line inside a flattened table is worth less than one in prose.

Everything is capped, and the caps are visible in the output, because a document that
was truncated must not read as a document that said nothing about retention.
"""

import re

import docread

# Ceilings, all of them, so a caller can see the whole budget at once.
MAX_TEXT = 400000        # characters read from one file
MAX_LINE_CHARS = 300
MAX_HEADINGS = 12
MAX_MONEY = 16
MAX_TERMS = 10
MAX_PARTIES = 6
MAX_REFERENCE = 6

# An amount is a currency token followed by digits. A bare number is not evidence:
# a bill of quantities is full of quantities. The lookbehind keeps `Rs` inside a
# word (Suppliers, cursors) from matching.
CURRENCY = r"(?:US\$|USD|LKR|SLR|Rs\.?|EUR|GBP|JPY|CNY|RMB|AUD|SGD)"
MONEY_RE = re.compile(
    r"(?<![A-Za-z])" + CURRENCY + r"\s*[:=]?\s*\(?\s*([0-9][0-9,]*(?:\.[0-9]{1,3})?(?:\s*(?:Mn|M|million|billion))?)",
    re.I,
)
# The written-out form a contract uses beside the figure: "Almar Rupees One
# Billion ... (LKR 1,881,773,646.24)". Its value is where the words and the digits
# disagree — it tells us the currency of a figure whose symbol was lost.
WORDED_RE = re.compile(r"\b(United States Dollars|Sri Lankan Rupees|Rupees)\b", re.I)

# "Northern Grid Board (hereinafter “the Employer”)" — the quote and the
# article can come in either order, which is why the first version of this
# pattern found no parties at all in the main contract.
PARTY_RE = re.compile(
    r"hereinafter\s+(?:referred\s+to\s+as\s+|called\s+)?[\"\u201c\u2018']?"
    r"(?:the\s+)?[\"\u201c\u2018']?\s*"
    r"(Employer|Contractor|Subcontractor|Engineer|Supplier|Purchaser|Consultant)[\"\u201d\u2019']?",
    re.I,
)
ORG_RE = re.compile(
    r"([A-Z][A-Za-z0-9&.,'\-]*(?:\s+[A-Za-z0-9&.,'\-()]+){1,10}?),?\s+"
    r"(?:a\s+(?:company|body|corporation|partnership)|duly\s+(?:registered|organized)|"
    r"having\s+its\s+registered\s+office|of\s+the\s+one\s+part|of\s+the\s+other\s+part)"
)

# Contract numbers as printed. The letters/certificate reader already has patterns
# for its own references; these are the shapes a contract agreement uses.
REFERENCE_RE = re.compile(
    r"\b(?:NO\.?|No\.?|numbered\s+as|number)\s*[:.]?\s*"
    r"([A-Z][A-Z0-9]*(?:[-/][A-Z0-9.]+){2,})"
)

# The terms the workbench prices against or reports. A line that states one of
# these is worth more than ten lines of definitions, which is why they are scored.
TERMS = (
    "contract price",
    "subcontract price",
    "awarded price",
    "contract amount",
    "advance payment",
    "retention",
    "liquidated damages",
    "performance security",
    "price adjustment",
    "price variation",
    "escalation",
    "taking-over",
    "time for completion",
    "completion period",
    "mobilization advance",
    "defects notification",
    "vat",
    "sscl",
)
TERM_RE = re.compile("|".join(re.escape(t) for t in TERMS), re.I)
STRONG_TERMS = (
    "contract price",
    "subcontract price",
    "awarded price",
    "contract amount",
    "original contract",
    "final contract amount",
)
HEADING_RE = re.compile(r"^#{1,4}\s+(.{2,140})$")
# A flattened html table is one enormous line of cells. It can still hold the
# price, but a prose line that says the same thing is better evidence.
TABLE_NOISE_RE = re.compile(r"</td>\s*<td>", re.I)


def _clean(text):
    return " ".join(str(text).split())


def _window(line, match, before=MAX_LINE_CHARS // 3):
    """The part of a long line around a match, rather than its first characters.

    The first version clipped every line to 300 characters before testing it, and
    the main contract states its price 370 characters into a paragraph that begins
    with the signature block — so the single most important line in the corpus was
    never seen. Clip *around the evidence*, never before looking for it.
    """
    if len(line) <= MAX_LINE_CHARS:
        return line
    start = max(0, match - before)
    end = min(len(line), start + MAX_LINE_CHARS)
    text = line[start:end]
    return ("…" if start > 0 else "") + text + ("…" if end < len(line) else "")


def _sentences(text):
    """Split long extracted lines on clause boundaries, keeping figures intact."""
    for line in text.split("\n"):
        if len(line) <= 240:
            yield line
            continue
        for part in re.split(r"(?<=[.;:])\s+(?=[A-Z(])", line):
            yield part


def _score(line):
    """How much a line is worth as evidence. Higher wins."""
    score = 0
    low = line.lower()
    if any(t in low for t in STRONG_TERMS):
        score += 6
    if MONEY_RE.search(line):
        score += 3
    if WORDED_RE.search(line):
        score += 2
    if TERM_RE.search(line):
        score += 1
    if TABLE_NOISE_RE.search(line):
        score -= 3
    if len(line) > 260:
        score -= 1
    return score


def evidence(path, max_text=MAX_TEXT):
    """The passages of one document that a model needs to describe it.

    Returns ``{headings, money, terms, parties, references, truncated}``. An empty
    list means the document said nothing on that subject — a fact the model may
    report; ``truncated`` means the file was longer than the read budget, so an
    absence may be an artefact of that rather than of the document.
    """
    text = docread.read_text(path, max_text)
    out = {
        "headings": [],
        "money": [],
        "terms": [],
        "parties": [],
        "references": [],
        "truncated": len(text) >= max_text - 1,
    }
    if not text:
        return out

    money = []
    terms = []
    parties = []
    references = []
    seen = set()

    def note(bucket, line):
        if line and line not in seen:
            seen.add(line)
            bucket.append(line)

    for raw in text.split("\n"):
        stripped = raw.strip()
        if not stripped:
            continue
        head = HEADING_RE.match(stripped)
        if head:
            if len(out["headings"]) < MAX_HEADINGS and head.group(1) not in out["headings"]:
                out["headings"].append(_clean(head.group(1))[:MAX_LINE_CHARS])
            continue
        for reference in REFERENCE_RE.finditer(stripped):
            if len(out["references"]) < MAX_REFERENCE:
                value = reference.group(1).strip(" .,;")
                if value and value not in out["references"]:
                    out["references"].append(value)
        # A PDF extraction puts the whole clause on one line, so a line can hold
        # the price, the retention and the advance in the order they were printed.
        # Each is clipped around its own match rather than the line being clipped
        # once, because the match can be anywhere in it.
        for sentence in _sentences(stripped):
            flat = " ".join(sentence.split())
            if len(flat) < 8:
                continue
            money_hit = MONEY_RE.search(flat) or WORDED_RE.search(flat)
            if money_hit:
                note(money, _window(flat, money_hit.start()))
            party_hit = PARTY_RE.search(flat) or ORG_RE.search(flat)
            if party_hit:
                note(parties, _window(flat, party_hit.start(), 90))
            term_hit = TERM_RE.search(flat)
            if term_hit:
                note(terms, _window(flat, term_hit.start(), 110))

    # Rank by how much the line states, then keep document order inside a score so
    # the answer reads like the contract it came from.
    def ranked(lines, limit):
        order = {line: i for i, line in enumerate(lines)}
        top = sorted(lines, key=lambda l: (-_score(l), order[l]))[:limit]
        return sorted(top, key=lambda l: order[l])

    out["money"] = ranked(money, MAX_MONEY)
    out["terms"] = ranked(terms, MAX_TERMS)
    out["parties"] = parties[:MAX_PARTIES]
    return out


def totals(doc):
    """How much evidence a document yielded, for a caller that wants one line."""
    return {
        "money": len(doc.get("money") or []),
        "terms": len(doc.get("terms") or []),
        "parties": len(doc.get("parties") or []),
        "references": len(doc.get("references") or []),
        "headings": len(doc.get("headings") or []),
    }
