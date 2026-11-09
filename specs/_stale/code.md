# Code the M3 audit deletes

The paths P08 deletes, from the approved M3 audit (§8 *Delete list*). P08 deletes these and nothing else.

## Deleted

| Path | Why |
|---|---|
| — | No engine, Studio or integration source is dead: every unreferenced engine module is an Alembic revision or a plugin loaded by path, and every Studio package serves a story |

## Not deleted — Ravi decides

| Path | Why it is here | Until Ravi decides |
|---|---|---|
| `engine/src/invana/plugins/tools/mail` | No story serves it; loaded by path and tested, so not dead by import (R119) | Kept — added to *Deleted* only on Ravi's yes |
| `engine/src/invana/plugins/tools/science` | No story serves it; loaded by path and tested, so not dead by import (R119) | Kept — added to *Deleted* only on Ravi's yes |
