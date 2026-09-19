"""starlette-admin views for auth (migration-plan §4.1).

Beside the code they describe, rather than in one 39-class file.
Sensitive columns stay out of ``fields`` so they are neither shown
nor editable.
"""

from __future__ import annotations

from starlette.requests import Request
from starlette_admin.contrib.sqla import ModelView


class UserView(ModelView):
    label = "Users"
    icon = "fa fa-user"
    fields = [
        "id",
        "email",
        "username",
        "first_name",
        "last_name",
        "preferences",
        "is_superuser",
        "is_active",
        "username_last_changed_at",
        "created_at",
        "updated_at",
    ]
    search_fields = ["email", "username", "first_name", "last_name"]
    sortable_fields = ["email", "username", "created_at", "updated_at"]

    # Users come from `invana init` (root) or the superuser register API — not admin UI.
    def can_create(self, request: Request) -> bool:
        return False


class RefreshTokenView(ModelView):
    label = "Refresh tokens"
    icon = "fa fa-key"
    fields = [
        "id",
        "user_id",
        "expires_at",
        "revoked_at",
        "created_at",
    ]
    sortable_fields = ["created_at", "expires_at", "revoked_at"]

    # Refresh tokens are session state — view + revoke (delete) only.
    def can_create(self, request: Request) -> bool:
        return False

    def can_edit(self, request: Request) -> bool:
        return False


class PersonalAccessTokenView(ModelView):
    label = "Personal access tokens"
    icon = "fa fa-key"
    # `token_hash` is excluded — a hash is still a credential lookup key, and the
    # secret itself was never stored
    # (docs/for-developers/modules/identity-and-access/features/personal-access-tokens.md PT2).
    fields = [
        "id",
        "user_id",
        "name",
        "last_four",
        "expires_at",
        "last_used_at",
        "revoked_at",
        "created_at",
    ]
    search_fields = ["name"]
    sortable_fields = ["created_at", "last_used_at", "expires_at", "revoked_at"]

    # An operator may revoke one, never mint or re-point one — a token belongs to
    # the person whose identity it carries.
    def can_create(self, request: Request) -> bool:
        return False

    def can_edit(self, request: Request) -> bool:
        return False
