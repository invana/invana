---
"invana": patch
---

`invana init` no longer defaults any value. The interactive prompts start empty, and `--non-interactive` requires `--username`, `--password` and `--first-name`, so an install never gets the well-known `admin` / `change_me_please` account unless someone types it.

`docker compose up` runs a one-off `engine-migrate` container that applies pending migrations before the engine starts. It creates no users.
