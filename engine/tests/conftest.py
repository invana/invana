"""Suite-wide setup, run before any ``invana`` import.

Telemetry is off for the suite: with it on, ``invana/__init__`` registers OTel exporters aimed at a
collector that is not there, and their background threads log into other tests' ``caplog`` and
sessions. Tests that need spans install their own in-memory exporter.
"""

import os

os.environ.setdefault("INVANA_TELEMETRY_ENABLED", "false")
