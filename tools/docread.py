# -*- coding: utf-8 -*-
"""Text out of whatever a project folder happens to hold.

A corpus is not always a tree of markdown letters. On another machine the same
records arrive as Word documents, as PDFs exported from the contract system, or
as scans that went through an OCR pass and kept the text layer. The reader has to
get text out of those too, or 'Analyze with model' can only describe the file
names and the model has to guess what is inside them.

Nothing here is a document converter:

* `.docx` is read through python-docx, which the bundled runtime ships.
* `.pdf` is read by decompressing the content streams and collecting the string
  operands of the text operators. That recovers the text layer of an OCR'd scan
  and the text of a generated PDF; it does not recover a page that is only an
  image, and it makes no attempt at font encodings beyond Latin-1.
* anything else is read as UTF-8 with replacement.

Every reader is bounded by a byte budget, because the only consumer is a
description of the folder that has to fit in a model's context window.
"""

import os
import re
import zlib

TEXT_EXT = (".md", ".txt", ".csv")
WORD_EXT = (".docx",)
PDF_EXT = (".pdf",)

# A single document is never read past this: a 13 MB scanned certificate has its
# text layer in the first pages, and the rest is page images.
MAX_READ_BYTES = 2 * 1024 * 1024


def _read_bytes(path):
    try:
        size = os.path.getsize(path)
    except OSError:
        return b""
    try:
        with open(path, "rb") as fh:
            return fh.read(min(size, MAX_READ_BYTES))
    except OSError:
        return b""


def _looks_like_text(text):
    """Whether an extraction produced words or the insides of a font.

    A PDF whose text is stored in a CID-keyed font yields byte soup: the operators
    are found and the operands are collected, but each operand is a glyph index
    rather than a character. Printing that to a model is worse than printing
    nothing, because it looks like a document and reads like noise.
    """
    if not text:
        return False
    good = sum(1 for ch in text if ch.isalnum() or ch in " .,;:()/-'\"&%$#@!?*+=<>[]\n\t")
    return good / len(text) >= 0.85


def pdf_text(path, limit=4000):
    """The text layer of a PDF, or '' when it has none.

    Content streams are Flate-compressed in every PDF this workbench has met, so
    a stream that will not decompress is skipped rather than guessed at. The text
    operators are `Tj` (one string) and `TJ` (an array of strings); collecting
    their parenthesised operands recovers the run of text in reading order for a
    simple page, which is all a description needs.
    """
    raw = _read_bytes(path)
    if not raw:
        return ""
    out = []
    total = 0
    for match in re.finditer(rb"stream\r?\n", raw):
        start = match.end()
        end = raw.find(b"endstream", start)
        if end < 0:
            continue
        try:
            data = zlib.decompress(raw[start:end])
        except zlib.error:
            continue
        if b"Tj" not in data and b"TJ" not in data:
            continue
        for tm in re.finditer(rb"\((?:\\.|[^\\()])*\)", data):
            text = tm.group(0)[1:-1]
            text = text.replace(b"\\(", b"(").replace(b"\\)", b")").replace(b"\\\\", b"\\")
            piece = text.decode("latin-1", "replace")
            out.append(piece)
            total += len(piece)
        out.append(" ")
        if total >= limit:
            break
    joined = re.sub(r"\s+", " ", " ".join(out)).strip()[:limit]
    return joined if _looks_like_text(joined) else ""


def docx_text(path, limit=4000):
    """Paragraph text of a Word document, in document order.

    Paragraphs keep their line breaks: a letter's `[LetterNo]` header is one
    paragraph and its value must not run on into the date and the subject of the
    paragraph below, which is what happens when the document is flattened into a
    single line.
    """
    try:
        from docx import Document
    except Exception:
        return ""
    try:
        doc = Document(path)
    except Exception:
        return ""
    out = []
    total = 0
    for para in doc.paragraphs:
        text = (para.text or "").strip()
        if not text:
            continue
        out.append(text)
        total += len(text)
        if total >= limit:
            break
    if total < 200:
        # A letter laid out in a table puts its text in cells, not paragraphs.
        for table in doc.tables:
            for row in table.rows:
                cells = [c.text.strip() for c in row.cells if (c.text or "").strip()]
                if not cells:
                    continue
                out.append(" | ".join(cells))
                total += sum(len(c) for c in cells)
                if total >= limit:
                    break
            if total >= limit:
                break
    return "\n".join(out)[:limit]


def plain_text(path, limit=4000):
    raw = _read_bytes(path)
    if not raw:
        return ""
    return re.sub(r"\s+", " ", raw.decode("utf-8", "replace")).strip()[:limit]


def ext(path):
    return os.path.splitext(path)[1].lower()


def read_text(path, limit=4000):
    """Text from any supported document, or '' when the format carries none."""
    kind = ext(path)
    if kind in PDF_EXT:
        return pdf_text(path, limit)
    if kind in WORD_EXT:
        return docx_text(path, limit)
    if kind in TEXT_EXT:
        return plain_text(path, limit)
    return ""


def readable(path):
    """Whether this file is one the reader can get text out of."""
    return ext(path) in TEXT_EXT + WORD_EXT + PDF_EXT


def head_lines(path, count=16, chars=220, limit=4000):
    """The first `count` non-empty lines of a document, trimmed."""
    text = read_text(path, limit)
    if not text:
        return []
    if ext(path) in TEXT_EXT:
        # Markdown keeps its `[Key] value` header on separate lines, so the line
        # structure is the identity of the letter and has to survive.
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                raw = fh.read(limit)
        except OSError:
            raw = text
        lines = [ln.strip()[:chars] for ln in raw.splitlines() if ln.strip()]
        return lines[:count]
    return [text[i:i + chars] for i in range(0, min(len(text), count * chars), chars)][:count]
