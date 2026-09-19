"""Regenerate the golden files: ``uv run python -m tests.golden.update``.

Do this only when the contract is meant to change. A refactor that needs it
has moved something it was not supposed to.
"""

from __future__ import annotations

from tests.golden.snapshots import (
    MIGRATED_DDL_FILE,
    MODELS_DDL_FILE,
    OPENAPI_FILE,
    migrated_ddl,
    models_ddl,
    openapi_document,
)


def main() -> None:
    OPENAPI_FILE.write_text(openapi_document())
    print(f"wrote {OPENAPI_FILE}")
    MODELS_DDL_FILE.write_text(models_ddl())
    print(f"wrote {MODELS_DDL_FILE}")
    MIGRATED_DDL_FILE.write_text(migrated_ddl())
    print(f"wrote {MIGRATED_DDL_FILE}")


if __name__ == "__main__":
    main()
