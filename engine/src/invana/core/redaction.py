"""
The one rule for what is never written down — not in an event, not in a log.

A key is sensitive when, lower-cased, it is or ends with one of ``SENSITIVE_SUFFIXES``:
``password``, ``api_key``, ``secret``, ``token``, or a stored form of one
(``*_hash``, ``*_encrypted``). Matching on the suffix catches ``password_hash``,
``old_api_key`` and ``refresh_token`` without listing each. A value is sensitive by
type when it is a pydantic ``SecretStr`` / ``SecretBytes``, whatever its key.

Usage
-----
    from invana.core.redaction import is_sensitive, redact

    redact({"name": "x", "api_key": "sk-…", "nested": [{"token": "t"}]})
    # → {"name": "x", "nested": [{}]}

    is_sensitive("password_hash")   # True

Sensitive keys are **dropped**, not masked: a stored or shipped record never says
a secret was there to be found. A value that is secret by type is masked, because
its key is ordinary and dropping it would hide that the field exists at all.

The audit log applies ``redact`` to an event's details before insert; the logging
pipeline applies it to every record's structured fields before any handler writes
them. Callers should not pass secrets in the first place — this is the defence
that holds when one does.
"""

from __future__ import annotations

from typing import Any

from pydantic import SecretBytes, SecretStr

SENSITIVE_SUFFIXES: tuple[str, ...] = (
    "_hash",
    "_encrypted",
    "password",
    "api_key",
    "secret",
    "token",
)

MASK = "**********"


def is_sensitive(key: str) -> bool:
    """Whether a field named ``key`` must never be written down."""
    k = key.lower()
    return any(k == s or k.endswith(s) for s in SENSITIVE_SUFFIXES)


def redact(value: Any) -> Any:
    """``value`` with sensitive keys dropped at any depth and secret-typed values masked.

    Dicts, lists and tuples are rebuilt; every other value passes through as is.
    """
    if isinstance(value, (SecretStr, SecretBytes)):
        return MASK
    if isinstance(value, dict):
        return {k: redact(v) for k, v in value.items() if not (isinstance(k, str) and is_sensitive(k))}
    if isinstance(value, (list, tuple)):
        return type(value)(redact(item) for item in value)
    return value
