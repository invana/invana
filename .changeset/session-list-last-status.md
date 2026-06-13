---
"invana": patch
"studio": patch
---

Surface failed/running state in the Explorer sessions list.

The session list only loads summaries (no messages), so a failed query showed the same neutral dot as an empty session — the list never reflected that a session failed. The engine now denormalizes the latest assistant reply's status onto the session (`last_status`, maintained on send/rerun), and the Explorer list row colours its dot from it: red for error, amber-pulse for running.
