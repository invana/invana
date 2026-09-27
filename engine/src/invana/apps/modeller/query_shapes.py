"""A query's shape: its text with the literals taken out (the-model-page.md MP37).

Strings and numbers become ``$p0``, ``$p1`` … in the order they appear; the
parameters a query already has stay; whitespace collapses. A variable-length
bound — ``*1..3`` — is structure, not a value, and stays. The shape's hash is
the SHA-256 of the result, cut to 16 hex, so a thousand calls of one generated
query are one row on the Performance tab.
"""

from __future__ import annotations

import hashlib
import re

_STRING = re.compile(r"'(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\"")
_NUMBER = re.compile(r"(?<![\w$.`*])-?\d+(?:\.\d+)?(?![\w`.])")
_SPACE = re.compile(r"\s+")

#: Past this a shape is cut — the hash is still of the whole text.
MAX_SHAPE_TEXT = 4000


def shape_of(text: str) -> tuple[str, str]:
    """``(shape_hash, shape_text)`` for one query."""
    n = 0

    def param(_: re.Match) -> str:
        nonlocal n
        name = f"$p{n}"
        n += 1
        return name

    # Strings first, so a number inside a string is never counted twice.
    parts = _STRING.split(text)
    strings = _STRING.findall(text)
    out = []
    for i, part in enumerate(parts):
        out.append(_NUMBER.sub(param, part))
        if i < len(strings):
            out.append(param(None))  # type: ignore[arg-type]
    shape = _SPACE.sub(" ", "".join(out)).strip()
    digest = hashlib.sha256(shape.encode()).hexdigest()[:16]
    return digest, shape[:MAX_SHAPE_TEXT]
