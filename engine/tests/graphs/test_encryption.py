"""Tests for Fernet credential encryption helpers."""

from __future__ import annotations

import pytest
from cryptography.fernet import Fernet, InvalidToken

from invana.graphs.encryption import decrypt_credentials, encrypt_credentials

KEY = Fernet.generate_key().decode()


class TestEncryptDecryptCredentials:
    def test_roundtrip(self):
        data = {"username": "neo4j", "password": "s3cret"}
        token = encrypt_credentials(data, KEY)
        assert isinstance(token, bytes)
        recovered = decrypt_credentials(token, KEY)
        assert recovered == data

    def test_empty_dict(self):
        token = encrypt_credentials({}, KEY)
        assert decrypt_credentials(token, KEY) == {}

    def test_wrong_key_raises(self):
        data = {"username": "u", "password": "p"}
        token = encrypt_credentials(data, KEY)
        wrong_key = Fernet.generate_key().decode()
        with pytest.raises(InvalidToken):
            decrypt_credentials(token, wrong_key)

    def test_nested_values(self):
        data = {"token": "abc123", "extra": {"scope": "read"}}
        token = encrypt_credentials(data, KEY)
        assert decrypt_credentials(token, KEY) == data
