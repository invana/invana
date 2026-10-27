"""Suite-wide setup, run before any ``invana`` import.

Telemetry is off for the suite: with it on, ``invana/__init__`` registers OTel exporters aimed at a
collector that is not there, and their background threads log into other tests' ``caplog`` and
sessions. Tests that need spans install their own in-memory exporter.

Steps run inline: the suite starts no ``invana worker``, so a queued tool step would wait out its
timeout. The worker tests switch the executor to ``procrastinate`` themselves.
"""

import os

os.environ.setdefault("INVANA_TELEMETRY_ENABLED", "false")
os.environ.setdefault("INVANA_EXECUTOR", "inline")
