"""Authentication & authorisation — Layer 1 (RFC-017).

See docs/internal/mvp/layer-1-identity-access.md for the design.

User-level deps live here; graph-scoped deps live in
:mod:`invana.graphs.deps`.
"""

from invana.auth.deps import get_current_user, require_superuser

__all__ = ["get_current_user", "require_superuser"]
