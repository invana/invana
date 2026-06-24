---
"studio": patch
---

Fix a render crash when the `?settings=` search param points at an unknown or removed section (e.g. a stale `?settings=instructions` bookmark).

The settings panel now validates the param against the known sections and falls back to **Info** for anything unrecognized, instead of throwing on an undefined section lookup.
