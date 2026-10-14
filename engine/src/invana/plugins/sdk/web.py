"""The web, as the tool plugins reach it — one client, one robots check, one HTML reader.

Every ``web.*`` and science task type goes out through this module, so they
share one user agent, one answer to "may Invana read this page?", and one
mapping from what a server said to the failure class the interpreter acts on
(docs/for-developers/modules/platform/features/tool-plugins.md):

| What happened | Raised as |
|---|---|
| connection refused, DNS, timeout, a 5xx, a 429 | ``TaskFailure(cls="transient")`` — retried |
| any other 4xx, a 404 | ``TaskFailure(cls="blocked")`` with ``evidence = {url, status}`` |
| robots.txt disallows the URL | ``TaskFailure(cls="blocked", cause="robots_disallowed")`` |
| a body past its cap (:func:`stream_to`) | ``TaskFailure(cls="blocked", cause="too_large")`` |

Usage::

    from invana.plugins.sdk import web

    async with web.client() as http:
        if not await web.robots_allows(url, http):
            raise web.robots_refusal(url)
        response = await web.get(url, http)
        title, text, links = web.html_to_text(response.text, base_url=str(response.url))

    data = await web.get_json("https://rest.uniprot.org/uniprotkb/P69905.json")

A robots.txt that cannot be read — no file, a 404, a network error — allows
the fetch, which is how crawlers read the convention; a 401 or 403 on it
disallows the whole site, as :mod:`urllib.robotparser` does.
"""

from __future__ import annotations

import importlib.metadata
import re
from collections.abc import Callable
from datetime import UTC, datetime
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import httpx

from invana.plugins.sdk.errors import TaskFailure

#: The product token robots.txt rules are matched against.
AGENT = "Invana"
DEFAULT_TIMEOUT_S = 30.0

#: Tags whose text is never page content.
_SKIP = frozenset({"script", "style", "noscript", "template", "svg", "head"})
#: Tags that end a line of text.
_BLOCK = frozenset(
    {"p", "div", "br", "li", "ul", "ol", "tr", "table", "section", "article", "header", "footer", "nav", "pre"}
    | {"h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "dd", "dt", "hr", "main", "aside", "form"}
)


def user_agent() -> str:
    try:
        version = importlib.metadata.version("invana-engine")
    except importlib.metadata.PackageNotFoundError:
        version = "0.0.0"
    return f"{AGENT}/{version} (+https://invana.io)"


def client(timeout_s: float = DEFAULT_TIMEOUT_S) -> httpx.AsyncClient:
    """The one HTTP client the tool plugins use: Invana's user agent, redirects followed."""
    return httpx.AsyncClient(
        headers={"User-Agent": user_agent()},
        follow_redirects=True,
        timeout=httpx.Timeout(timeout_s),
    )


def now() -> str:
    """An ISO-8601 UTC timestamp — what ``fetched_at`` and friends carry."""
    return datetime.now(UTC).isoformat()


# ── failures ──────────────────────────────────────────────────────────────────


def blocked(message: str, *, cause: str, **evidence: Any) -> TaskFailure:
    """A refusal a retry cannot fix — the message is the one sentence a person reads."""
    return TaskFailure(cls="blocked", cause=cause, message=message, short=message[:60], evidence=evidence)


def transient(message: str, *, cause: str, **evidence: Any) -> TaskFailure:
    """A failure a retry may fix — the network, or a server having a bad minute."""
    return TaskFailure(cls="transient", cause=cause, message=message, short=message[:60], evidence=evidence)


def network_failure(url: str, exc: Exception) -> TaskFailure:
    host = urlsplit(url).netloc or url
    return transient(f"Could not reach {host}: {type(exc).__name__}.", cause="network_error", url=url)


def status_failure(url: str, status: int) -> TaskFailure:
    """The failure a non-2xx answer raises: 5xx and 429 are transient, every other 4xx blocked."""
    host = urlsplit(url).netloc or url
    if status >= 500 or status == 429:
        return transient(f"{host} answered {status}; try again later.", cause="upstream_error", url=url, status=status)
    if status == 404:
        return blocked(f"Nothing was found at {url}.", cause="not_found", url=url, status=status)
    return blocked(f"{host} refused the request with {status}.", cause="request_refused", url=url, status=status)


def robots_refusal(url: str) -> TaskFailure:
    return blocked(f"robots.txt on {urlsplit(url).netloc} disallows reading {url}.", cause="robots_disallowed", url=url)


def check_url(url: object) -> str:
    """An absolute http(s) URL, or a ``blocked · bad_url`` refusal."""
    text = str(url or "").strip()
    parts = urlsplit(text)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        raise blocked(f"'{text}' is not an http or https URL.", cause="bad_url", url=text)
    return text


# ── requests ──────────────────────────────────────────────────────────────────


async def get(url: str, http: httpx.AsyncClient, *, params: dict | None = None) -> httpx.Response:
    """GET ``url``; a network error or a non-2xx answer raises the mapped ``TaskFailure``."""
    try:
        response = await http.get(url, params=params)
    except httpx.HTTPError as exc:
        raise network_failure(url, exc) from exc
    if response.status_code >= 400:
        raise status_failure(str(response.url), response.status_code)
    return response


async def stream_to(
    url: str, http: httpx.AsyncClient, sink: Callable[[bytes], object], *, max_bytes: int
) -> httpx.Response:
    """GET ``url`` and hand its body to ``sink`` chunk by chunk.

    Past ``max_bytes`` it stops reading and raises ``blocked · too_large``, so a
    download never holds more than its cap. The returned response is closed;
    its status, headers and final URL are still readable.
    """
    try:
        async with http.stream("GET", url) as response:
            if response.status_code >= 400:
                raise status_failure(str(response.url), response.status_code)
            size = 0
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > max_bytes:
                    mb = max_bytes / 1_000_000
                    raise blocked(f"{url} is larger than {mb:g} MB.", cause="too_large", url=url, max_mb=mb)
                sink(chunk)
            return response
    except httpx.HTTPError as exc:
        raise network_failure(url, exc) from exc


async def get_json(url: str, params: dict | None = None, *, http: httpx.AsyncClient | None = None) -> Any:
    """GET ``url`` and decode its JSON body; a body that is not JSON is ``transient · bad_response``."""
    if http is None:
        async with client() as own:
            return await get_json(url, params, http=own)
    response = await get(url, http, params=params)
    try:
        return response.json()
    except ValueError as exc:
        raise transient(
            f"{urlsplit(url).netloc} answered with something that is not JSON.", cause="bad_response", url=url
        ) from exc


async def robots_allows(url: str, http: httpx.AsyncClient | None = None) -> bool:
    """Whether robots.txt on ``url``'s site lets the ``Invana`` agent read it."""
    if http is None:
        async with client() as own:
            return await robots_allows(url, own)
    parts = urlsplit(url)
    robots_url = f"{parts.scheme}://{parts.netloc}/robots.txt"
    try:
        response = await http.get(robots_url)
    except httpx.HTTPError:
        return True
    if response.status_code in (401, 403):
        return False
    if response.status_code >= 400:
        return True
    parser = RobotFileParser(robots_url)
    parser.parse(response.text.splitlines())
    return parser.can_fetch(AGENT, url)


# ── HTML → text ───────────────────────────────────────────────────────────────


class _Reader(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.title: list[str] = []
        self.chunks: list[str] = []
        self.links: list[str] = []
        self._skip = 0
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self._in_title = True
        elif tag in _SKIP:
            self._skip += 1
        elif tag == "a":
            href = dict(attrs).get("href")
            if href:
                link = urljoin(self.base_url, href.strip()).split("#", 1)[0]
                if urlsplit(link).scheme in ("http", "https") and link not in self.links:
                    self.links.append(link)
        if tag in _BLOCK:
            self.chunks.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag in _SKIP and self._skip:
            self._skip -= 1
        if tag in _BLOCK:
            self.chunks.append("\n")

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title.append(data)
        elif not self._skip:
            self.chunks.append(data)


def html_to_text(html: str, *, base_url: str = "") -> tuple[str, str, list[str]]:
    """``(title, text, links)`` of an HTML page.

    Scripts, styles and the head are dropped, block tags end a line, runs of
    whitespace collapse, and links are absolute http(s) URLs in first-seen order
    with fragments removed.
    """
    reader = _Reader(base_url)
    reader.feed(html)
    reader.close()
    lines = (re.sub(r"[ \t\r\f\v]+", " ", line).strip() for line in "".join(reader.chunks).split("\n"))
    text = "\n".join(line for line in lines if line)
    title = re.sub(r"\s+", " ", "".join(reader.title)).strip()
    return title, text, reader.links
