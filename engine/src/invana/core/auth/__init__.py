"""Authentication & authorisation — Layer 1 (docs/for-developers/modules/identity-and-access/spec.md).

See docs/for-developers/modules/identity-and-access/spec.md for the design.

User-level deps live here; graph-scoped deps live in
:mod:`invana.server.graphs.deps`.
"""

from invana.core.auth.deps import get_current_user, require_superuser

__all__ = ["get_current_user", "require_superuser"]
