"""The OpenAPI document is the frontend contract. A non-empty diff here means a
route, schema, field, enum or status code moved — stop, do not regenerate."""

from __future__ import annotations

import difflib

from tests.golden.snapshots import OPENAPI_FILE, openapi_document


def test_openapi_matches_golden() -> None:
    expected = OPENAPI_FILE.read_text()
    actual = openapi_document()
    if actual != expected:
        diff = "".join(
            difflib.unified_diff(
                expected.splitlines(keepends=True),
                actual.splitlines(keepends=True),
                fromfile=str(OPENAPI_FILE),
                tofile="app.openapi()",
                n=2,
            )
        )
        raise AssertionError(f"OpenAPI document changed:\n{diff}")
