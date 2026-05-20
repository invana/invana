"""Password hashing wrapper around passlib's bcrypt context.

All tunables live in ``settings`` under the ``auth_`` prefix.
"""

from __future__ import annotations

from passlib.context import CryptContext

from invana.settings import settings


class WeakPasswordError(ValueError):
    """Raised when a password does not meet the minimum length requirement."""


_pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=settings.auth_bcrypt_rounds,
)


def hash_password(plaintext: str) -> str:
    if len(plaintext) < settings.auth_min_password_length:
        raise WeakPasswordError(f"Password must be at least {settings.auth_min_password_length} characters long.")
    return _pwd_context.hash(plaintext)


def verify_password(plaintext: str, hashed: str) -> bool:
    try:
        return _pwd_context.verify(plaintext, hashed)
    except ValueError:
        return False
