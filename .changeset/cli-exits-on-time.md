---
"invana": patch
---

An `invana` command exits within about five seconds of finishing even when the telemetry collector is unreachable (it used to wait about twenty), and its logs now reach the collector — the CLI no longer rebuilds logging and drops the OTLP log handler.
