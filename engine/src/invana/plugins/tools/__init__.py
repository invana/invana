"""The tool plugins — task types that reach outside Invana: the web, mail, science sources.

Each loads only when its extra is installed, is disabled until an install
Admin enables it, and runs in a worker under the ``procrastinate`` executor
(docs/for-developers/modules/platform/features/tool-plugins.md).
"""
