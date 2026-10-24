"""The tool plugins: loaded from their folders, honouring robots.txt, and reading only declared secrets.

``web.read_url`` runs against a real HTTP server on localhost — a page, a
disallowed path and the robots.txt that disallows it.
"""

from __future__ import annotations

import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import ClassVar

import pytest

from invana.plugins import load_plugins
from invana.plugins.sdk.context import TaskContext
from invana.plugins.sdk.errors import TaskFailure
from invana.plugins.sdk.manifest import Bound, SideEffect
from invana.runtime.models import TaskRun

KEYS = {
    "invana.tools.web": {"web.search", "web.read_url", "web.download_file"},
    "invana.tools.mail": {"mail.read", "mail.send"},
    "invana.tools.science": {"science.pubmed.search", "science.uniprot.get", "science.pubchem.get"},
}

PAGE = (
    "<html><head><title>Airports of Iceland</title><style>p{}</style></head>"
    "<body><h1>Airports</h1><p>Keflavik is the main one.</p><script>var x</script>"
    '<a href="/airports/kef">KEF</a> <a href="https://example.org/#top">elsewhere</a></body></html>'
)
ROBOTS = "User-agent: Invana\nDisallow: /private\n"


class _Site(BaseHTTPRequestHandler):
    seen: ClassVar[list[str]] = []

    def do_GET(self) -> None:
        _Site.seen.append(self.path)
        body, kind = {"/robots.txt": (ROBOTS, "text/plain"), "/page": (PAGE, "text/html; charset=utf-8")}.get(
            self.path, ("secret", "text/plain")
        )
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, *args) -> None:
        pass


@pytest.fixture
def site() -> Iterator[str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), _Site)
    _Site.seen = []
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()
    server.server_close()


def _ctx(args: dict | None = None, secrets: tuple[str, ...] = ()) -> TaskContext:
    """A context with nothing a tool task type does not touch: its step's args and its secrets."""
    return TaskContext(db=None, manager=None, emitter=None, step=TaskRun(args=args or {}), secrets=secrets)  # type: ignore[arg-type]


def test_the_three_tool_plugins_load_with_their_task_types_and_skill() -> None:
    registry = load_plugins()
    for name, keys in KEYS.items():
        plugin = registry.plugins[name]
        assert plugin.manifest.kind == "tool" and plugin.manifest.version == "0.1.0"
        assert {t.key for t in plugin.tasks} == keys
        assert all(t.bound is Bound.network for t in plugin.tasks)
    assert registry.task("mail.send").side_effect is SideEffect.send
    assert registry.task("mail.send").retries == 0
    assert registry.task("web.download_file").timeout_s == 120
    assert registry.plugins["invana.tools.web"].manifest.secrets == ("web_search",)
    (skill,) = registry.plugins["invana.tools.web"].skills
    assert skill.slug == "collect-dataset" and skill.name == "Collect a dataset from the web"
    assert skill.instructions.strip()


async def test_web_fetch_reads_an_allowed_page_and_refuses_a_disallowed_one(site: str) -> None:
    fetch = load_plugins().task("web.read_url").run
    ctx = _ctx({"url": f"{site}/page"})

    out = await fetch(ctx, None)

    assert out.output["url"] == f"{site}/page"
    assert out.output["title"] == "Airports of Iceland"
    assert "Keflavik is the main one." in out.output["text"] and "var x" not in out.output["text"]
    assert out.output["links"] == [f"{site}/airports/kef", "https://example.org/"]
    assert out.output["fetched_at"]

    with pytest.raises(TaskFailure) as refused:
        await fetch(_ctx({"url": f"{site}/private/data"}), None)
    assert refused.value.cls == "blocked" and refused.value.cause == "robots_disallowed"
    assert refused.value.evidence["url"] == f"{site}/private/data"
    assert "/private/data" not in _Site.seen, "a disallowed URL is never requested"


def test_a_secret_is_read_only_when_declared_and_set(monkeypatch: pytest.MonkeyPatch) -> None:
    ctx = _ctx(secrets=("web_search",))

    with pytest.raises(TaskFailure) as undeclared:
        ctx.secret("smtp")
    assert undeclared.value.cause == "secret_undeclared"

    monkeypatch.delenv("INVANA_SECRET_WEB_SEARCH", raising=False)
    with pytest.raises(TaskFailure) as missing:
        ctx.secret("web_search")
    assert missing.value.cls == "blocked" and missing.value.cause == "secret_missing"
    assert missing.value.evidence["env"] == "INVANA_SECRET_WEB_SEARCH"

    monkeypatch.setenv("INVANA_SECRET_WEB_SEARCH", "http://searx.local")
    assert ctx.secret("web_search") == "http://searx.local"
