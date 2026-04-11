"""Fernet-based credential encryption for graph connection auth."""

from __future__ import annotations

import json

from cryptography.fernet import Fernet, InvalidToken


def encrypt_credentials(data: dict, key: str) -> bytes:
    """Encrypt a credentials dict to Fernet token bytes.

    Args:
        data: Dict of auth fields, e.g. ``{"username": "neo4j", "password": "secret"}``.
        key: 32-byte URL-safe base64 Fernet key string (``INVANA_ENCRYPTION_KEY``).

    Returns:
        Fernet-encrypted bytes suitable for storing in ``Graph.auth_encrypted``.
    """
    return Fernet(key.encode()).encrypt(json.dumps(data).encode())


def decrypt_credentials(token: bytes, key: str) -> dict:
    """Decrypt Fernet token bytes back to a credentials dict.

    Args:
        token: Bytes previously produced by :func:`encrypt_credentials`.
        key: Same Fernet key used for encryption.

    Returns:
        Original credentials dict.

    Raises:
        InvalidToken: If the token is malformed or the key is wrong.
    """
    try:
        raw = Fernet(key.encode()).decrypt(token)
    except InvalidToken as exc:
        raise InvalidToken("Failed to decrypt graph credentials — check INVANA_ENCRYPTION_KEY.") from exc
    return json.loads(raw)
