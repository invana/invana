"""Re-seed the boards whose data is relative to now, right before a live shoot.

Worker heartbeats, the 30-minute charts and the *Add workers* waiting timer are
written as "now" by ``seed_f06.py``; an hour later the same rows read as stale
(``4038 s`` heartbeats, empty charts). The driver and the design reviewer run
this before ``shoot.mjs --live`` so every shot draws fresh data.

It seeds the dev stack's Postgres from the host — ``INVANA_DATABASE_URL`` if set,
else docker-compose's default — with telemetry off. Run from anywhere:

    python3 scripts/agents-build/reseed.py
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEEDS = ["seed_f06.py", "seed_f04.py"]
DEV_DB = "postgresql+asyncpg://invana_user:change_this_password@localhost:5432/invana_db"


def main() -> int:
    env = {
        **os.environ,
        "INVANA_DATABASE_URL": os.environ.get("INVANA_DATABASE_URL", DEV_DB),
        "INVANA_TELEMETRY_ENABLED": "false",
        "OTEL_SDK_DISABLED": "true",
    }
    for seed in SEEDS:
        cmd = ["uv", "run", "--directory", "engine", "python", f"../scripts/agents-build/{seed}"]
        if subprocess.run(cmd, cwd=ROOT, env=env).returncode != 0:
            print(f"reseed: {seed} failed", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
