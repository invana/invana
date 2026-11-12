"""MkDocs build hook for the spec site: the graph parser's view of every spec page.

Loaded by ``mkdocs.yml`` (``hooks:``). At the start of a build it runs the parser in ``scripts/specs/graph.py`` once
— the same parse ``check.py --graph`` writes to ``specs-graph.json`` — and then:

| Event | Adds |
|---|---|
| ``on_files`` | The generated pages ``graph.md`` (the graph app in a frame), ``loops.md``, ``gaps.md``, ``orphans.md`` and ``tags.md``, listing ``analysis`` with links |
| ``on_nav`` | Titles in the left tree from the specs' front-matter, never folder slugs: a product or feature folder is a section titled ``<id> · <title>`` whose index is its ``product.md`` or ``feature.md``; a story folder is one entry, its ``story.md``; the ``features/`` and ``stories/`` folders fold into their parent; ``os/`` reads *Operating system* |
| ``on_page_markdown`` | Tags (kind, status, persona) for Material's tags plugin; a banner on a placeholder page; and, on every page a node is parsed from, a *Graph* section with each node's *Show in graph* link, its Depends on / Used by / Gaps tabs and its one-hop mermaid neighbourhood |
| ``on_post_build`` | The graph app's build (``graph/dist``) copied to ``<site>/graph/app/``, with the parse beside it as ``specs-graph.json`` |

The parser owns the analysis: cycles, chains, blockers, orphans, gaps and dangling references are read from its
``analysis`` block and only rendered here, never recomputed.

The rendering functions are pure — they take the parsed data and a page's path under ``specs/`` and return markdown —
so ``scripts/specs/test_site.py`` tests them without MkDocs. Usage::

    data = load()                      # the parsed graph, as in specs-graph.json
    ix = Index(data)
    markdown += graph_section(ix, 'capabilities/…/feature.md')
"""
import json
import posixpath
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import graph as specgraph  # noqa: E402  (scripts/specs/graph.py)

SPECS_PREFIX = 'specs/'
# The pages the build adds; each is listed in the nav after the specs.
GENERATED = ('graph.md', 'loops.md', 'gaps.md', 'orphans.md', 'tags.md')
# The graph app's build (`pnpm --dir scripts/specs/site/graph build`), copied to `<site>/graph/app/` with the parse.
GRAPH_APP = Path(__file__).resolve().parent / 'graph' / 'dist'
GRAPH_APP_URL = 'graph/app'
# Node kinds that are a page's own subject; Decisions are rows of their owner's page and appear through DECIDES.
PAGE_KINDS = ('Product', 'Feature', 'Story', 'Journey', 'Task', 'Persona', 'DesignSection', 'NFR')
NEIGHBOURS_MAX = 30  # one-hop diagram cap; the tables always list every edge
# The left tree: kinds titled `<id> · <title>`, folders whose page is their section's index, the story page that
# stands for its folder, grouping folders folded into their parent, and the titles of folders with no index page.
NAV_KINDS = ('Product', 'Feature', 'Story', 'Journey')
NAV_INDEX = ('product.md', 'feature.md')
NAV_STORY = 'story.md'
NAV_FOLD = ('features', 'stories')
NAV_FOLDERS = {'os': 'Operating system', 'capabilities': 'Capabilities', 'journeys': 'Journeys'}
GAP_TEXT = {
    'no-engine': 'no `## Engine` section',
    'placeholder-engine': '`## Engine` is a placeholder',
    'no-system-impact': 'no `## System impact` section',
    'placeholder-system-impact': '`## System impact` is a placeholder',
    'no-nfrs': 'no `nfrs:` in its front-matter',
}

_data = None


def load():
    """The parsed graph — the same dict ``check.py --graph`` writes."""
    return specgraph.to_json(specgraph.build())


class Index:
    """Lookups over the parsed graph: nodes by id and by page, edges in and out, and each node's analysis flags."""

    def __init__(self, data):
        self.data = data
        for n in data['nodes']:  # the parser writes OS paths; pages are always posix
            if n['path']:
                n['path'] = n['path'].replace('\\', '/')
        self.nodes = {n['id']: n for n in data['nodes']}
        self.out, self.into = defaultdict(list), defaultdict(list)
        for e in data['edges']:
            self.out[e['source']].append(e)
            self.into[e['target']].append(e)
        self.by_page = defaultdict(list)
        for n in data['nodes']:
            if n['path'] and n['path'].startswith(SPECS_PREFIX) and n['kind'] in PAGE_KINDS:
                self.by_page[n['path'][len(SPECS_PREFIX):]].append(n)
        a = data['analysis']
        self.cycles = defaultdict(list)
        for i, c in enumerate(a['cycles'], 1):
            for n in c:
                self.cycles[n].append(i)
        self.chains = defaultdict(list)
        for i, c in enumerate(a['chains'], 1):
            for n in c:
                self.chains[n].append(i)
        self.gaps = defaultdict(list)
        for g in a['gaps']:
            self.gaps[g['node']].append(g['gap'])
        self.orphans = set(a['orphans'])

    def page_of(self, nid):
        """The page under ``specs/`` a node is read from, or ``None``."""
        n = self.nodes.get(nid)
        if not n or not n['path'] or not n['path'].startswith(SPECS_PREFIX):
            return None
        return n['path'][len(SPECS_PREFIX):]


def href(from_page, to_page):
    """A relative markdown link target from one page under ``specs/`` to another."""
    return posixpath.relpath(to_page, posixpath.dirname(from_page) or '.')


def name(ix, nid):
    """How a node reads in a table: its id and title."""
    n = ix.nodes.get(nid)
    if not n:
        return f'`{nid}`'
    if n['kind'] in ('Persona', 'Board'):
        return n['title'] or nid
    return f'`{nid}` {n["title"]}'.strip()


def link(ix, from_page, nid):
    """A node as a markdown link to its page, or plain text when it has none."""
    text = name(ix, nid).replace('[', '\\[').replace(']', '\\]').replace('|', '\\|')
    page = ix.page_of(nid)
    if not page:
        return text
    return f'[{text}]({href(from_page, page)})' if page != from_page else text


def status(ix, nid):
    n = ix.nodes.get(nid, {})
    s = n.get('status') or '—'
    return f'{s} · placeholder' if n.get('placeholder') and s != specgraph.PLACEHOLDER else s


def edge_table(ix, page, edges, end):
    """Edges as a table: type, the node at ``end`` (``source`` or ``target``), its status and where it was read."""
    if not edges:
        return 'None.\n'
    rows = ['| Edge | Node | Status | Read from |', '|---|---|---|---|']
    for e in sorted(edges, key=lambda e: (e['type'], e[end])):
        rows.append(f'| `{e["type"]}` | {link(ix, page, e[end])} | {status(ix, e[end])} | {e["via"]} |')
    return '\n'.join(rows) + '\n'


def gap_items(ix, page, nid):
    """Every analysis flag on one node, as markdown bullets linking to the analysis pages."""
    a, items = ix.data['analysis'], []
    for g in ix.gaps[nid]:
        items.append(f'Gap — {GAP_TEXT.get(g, g)} · [all gaps]({href(page, "gaps.md")})')
    for b in a['blockers']:
        if b['source'] == nid:
            items.append(f'Blocked — `{b["type"]}` {link(ix, page, b["target"])}, which is at `idea` or a placeholder')
        if b['target'] == nid:
            items.append(f'Blocks {link(ix, page, b["source"])} (`{b["type"]}`) — this node is at `idea` or a placeholder')
    for i in ix.cycles[nid]:
        items.append(f'In loop {i} — {" → ".join(f"`{n}`" for n in a["cycles"][i - 1])} · [loops]({href(page, "loops.md")})')
    for i in ix.chains[nid]:
        items.append(f'On blocking chain {i} ({len(a["chains"][i - 1])} long) · [loops]({href(page, "loops.md")}#chains)')
    for d in a['dangling']:
        if d['source'] == nid:
            items.append(f'Dangling — `{d["ref"]}` ({d["via"]}): no file defines it, or the parser cannot read it')
    if nid in ix.orphans:
        items.append(f'Orphan — no edge at all · [orphans]({href(page, "orphans.md")})')
    return items


def mermaid_label(ix, nid):
    """A node's label in a mermaid diagram: kind and title for personas and boards, else id and title."""
    n = ix.nodes.get(nid, {})
    title = n.get('title') or ''
    if n.get('kind') in ('Persona', 'Board'):
        text = f'{n["kind"]}<br/>{title or nid}'
    else:
        text = f'{nid}<br/>{title}' if title else nid
    return text.replace('"', '#quot;')


def neighbourhood(ix, nid):
    """A one-hop mermaid flowchart around ``nid``: typed edges first, then mentions, capped at ``NEIGHBOURS_MAX``."""
    edges = ix.out[nid] + ix.into[nid]
    edges = sorted(edges, key=lambda e: (e['type'] == 'MENTIONS', e['type'], e['source'], e['target']))
    shown, more = [], 0
    neighbours = set()
    for e in edges:
        other = e['target'] if e['source'] == nid else e['source']
        if other not in neighbours and len(neighbours) >= NEIGHBOURS_MAX:
            more += 1
            continue
        neighbours.add(other)
        shown.append(e)
    ids = {n: f'n{i}' for i, n in enumerate([nid, *sorted(neighbours)])}  # ids never collide, whatever the node id
    lines = ['```mermaid', 'flowchart LR', f'  {ids[nid]}["{mermaid_label(ix, nid)}"]:::focus']
    for other in sorted(neighbours):
        cls = ':::placeholder' if ix.nodes.get(other, {}).get('placeholder') else ''
        lines.append(f'  {ids[other]}["{mermaid_label(ix, other)}"]{cls}')
    for e in shown:
        arrow = '-.->' if e['type'] == 'MENTIONS' else '-->'
        lines.append(f'  {ids[e["source"]]} {arrow}|{e["type"]}| {ids[e["target"]]}')
    lines += ['  classDef focus stroke-width:3px', '  classDef placeholder stroke-dasharray:4 3,opacity:0.6', '```']
    tail = f'\n{more} more edges are in the tables.\n' if more else ''
    return '\n'.join(lines) + '\n' + tail


def node_tabs(ix, page, nid):
    """The four tabs for one node: Depends on, Used by, Gaps and Neighbourhood."""
    out_e, in_e, gaps = ix.out[nid], ix.into[nid], gap_items(ix, page, nid)
    gap_md = '\n'.join(f'- {g}' for g in gaps) + '\n' if gaps else 'None.\n'
    tabs = [(f'Depends on ({len(out_e)})', edge_table(ix, page, out_e, 'target')),
            (f'Used by ({len(in_e)})', edge_table(ix, page, in_e, 'source')),
            (f'Gaps ({len(gaps)})', gap_md),
            ('Neighbourhood', neighbourhood(ix, nid) if out_e or in_e else 'No neighbours.\n')]
    return ''.join(f'=== "{title}"\n\n{indent(body)}\n' for title, body in tabs)


def indent(text, by='    '):
    return ''.join(by + line if line.strip() else line for line in text.splitlines(True))


def show_in_graph(page, nid):
    """A *Show in graph* link from a page to the ``/graph`` page, focused on one node."""
    return f'[Show in graph]({href(page, "graph.md")}?focus={quote(nid, safe="")})'


def graph_section(ix, page):
    """The *Graph* section for a page under ``specs/``, or ``''`` when no node is parsed from it."""
    nodes = ix.by_page.get(page, [])
    if not nodes:
        return ''
    head = ('\n\n## Graph\n\nParsed from this file by `check.py --graph`. Every row links to its page; nothing here '
            'is written by hand.\n\n')
    if len(nodes) == 1:
        return head + show_in_graph(page, nodes[0]['id']) + '\n\n' + node_tabs(ix, page, nodes[0]['id'])
    blocks = []
    for n in sorted(nodes, key=lambda n: (PAGE_KINDS.index(n['kind']), n['id'])):
        title = name(ix, n['id']).replace('`', '').replace('"', "'")
        body = show_in_graph(page, n['id']) + '\n\n' + node_tabs(ix, page, n['id'])
        blocks.append(f'??? note "{n["kind"]} · {title}"\n\n{indent(body)}\n')
    return head + ''.join(blocks)


def is_placeholder_page(ix, page, meta):
    """True when a page is at ``status: placeholder``, or its one node is a placeholder."""
    nodes = ix.by_page.get(page, [])
    return meta.get('status') == specgraph.PLACEHOLDER or (len(nodes) == 1 and nodes[0]['placeholder'])


def banner(markdown):
    """``markdown`` with the placeholder banner after its first heading (or at the top)."""
    note = ('!!! warning "Placeholder"\n\n    Nothing on this page is decided yet. It is named so the graph shows '
            'it — see [gaps](' + '{gaps}' + ').\n\n')
    m = re.search(r'^# .*\n', markdown, re.M)
    at = m.end() if m else 0
    return markdown[:at] + '\n' + note + markdown[at:]


def tags_for(ix, page, meta):
    """Material tags for a page: its kind, its status and each persona it serves."""
    nodes = ix.by_page.get(page, [])
    kind = nodes[0]['kind'] if len(nodes) == 1 else None
    tags = []
    if kind:
        tags.append(f'kind: {kind.lower()}')
    if meta.get('status'):
        tags.append(f'status: {meta["status"]}')
    personas = meta.get('personas') or []
    if isinstance(personas, list):
        tags += [f'persona: {p}' for p in personas]
    return tags


# --- the left tree ----------------------------------------------------------------------------------------------


def nav_label(ix, page):
    """A page's title in the tree — ``<id> · <title>`` from its front-matter — or ``None`` for a page of no one node."""
    nodes = [n for n in ix.by_page.get(page, []) if n['kind'] in NAV_KINDS]
    if len(nodes) != 1:
        return None
    n = nodes[0]
    return f'{n["id"]} · {n["title"]}' if n['title'] else n['id']


def _first_page(item):
    while item.is_section:
        item = item.children[0]
    return item


def fold_nav(ix, items, as_index, depth=0):
    """The tree MkDocs nests from folders, retitled and folded — see ``on_nav``.

    Works on any objects shaped like MkDocs' ``Section`` (``is_section``, ``title``, ``children``) and ``Page``
    (``is_section``, ``title``, ``file.src_uri``), so the tests need no MkDocs. ``depth`` is the folder depth of
    ``items``; ``as_index(page)`` makes a page its section's index (the section's label then links to it).
    """
    out = []
    for item in items:
        if not item.is_section:
            # Set only a label: before the build reads a page its title is still empty, and setting it fixes it.
            if getattr(item, 'file', None) and (label := nav_label(ix, item.file.src_uri)):
                item.title = label
            out.append(item)
            continue
        folder = _first_page(item).file.src_uri.split('/')[depth]
        # The folder's own files, read before folding lifts a sub-folder's pages into it.
        pages = {c.file.src_uri.rsplit('/', 1)[-1]: c for c in item.children if getattr(c, 'file', None)}
        children = fold_nav(ix, item.children, as_index, depth + 1)
        if NAV_STORY in pages:
            out.append(pages[NAV_STORY])
        elif folder in NAV_FOLD:
            out.extend(children)
        elif index := next((pages[p] for p in NAV_INDEX if p in pages), None):
            as_index(index)
            item.title = nav_label(ix, index.file.src_uri) or NAV_FOLDERS.get(folder, item.title)
            item.children = [index, *(c for c in children if c is not index)]
            out.append(item)
        else:
            item.title = NAV_FOLDERS.get(folder, item.title)
            item.children = children
            out.append(item)
    return out


def nav_pages(items):
    """Every page in a tree, in order."""
    out = []
    for item in items:
        if item.is_section:
            out += nav_pages(item.children)
        elif getattr(item, 'file', None):
            out.append(item)
    return out


def _link_nav(items, parent=None):
    for item in items:
        item.parent = parent
        if item.is_section:
            _link_nav(item.children, item)


# --- generated pages --------------------------------------------------------------------------------------------


def loops_page(ix):
    a = ix.data['analysis']
    out = ['# Loops', '',
           f'{len(a["cycles"])} loops and the {len(a["chains"])} longest blocking chains over `DEPENDS_ON`, from the '
           'parser\'s `analysis`.', '', '## Loops', '']
    if a['cycles']:
        out += ['| # | Size | Nodes |', '|---|---|---|']
        out += [f'| {i} | {len(c)} | {" → ".join(link(ix, "loops.md", n) for n in c)} |' for i, c in enumerate(a['cycles'], 1)]
    else:
        out.append('No loops.')
    out += ['', '## Chains', '', 'Longest first, the dependent first.', '']
    if a['chains']:
        out += ['| # | Length | Chain |', '|---|---|---|']
        out += [f'| {i} | {len(c)} | {" → ".join(link(ix, "loops.md", n) for n in c)} |' for i, c in enumerate(a['chains'], 1)]
    else:
        out.append('No chains of three or more.')
    return '\n'.join(out) + '\n'


def gaps_page(ix):
    a, page = ix.data['analysis'], 'gaps.md'
    by_node = defaultdict(list)
    for g in a['gaps']:
        by_node[g['node']].append(GAP_TEXT.get(g['gap'], g['gap']))
    out = ['# Gaps', '',
           f'{len(by_node)} features with gaps · {len(a["blockers"])} blockers · {len(a["dangling"])} dangling '
           'references, from the parser\'s `analysis`.', '', '## Feature gaps', '']
    if by_node:
        out += ['| Feature | Status | Gaps |', '|---|---|---|']
        out += [f'| {link(ix, page, n)} | {status(ix, n)} | {" · ".join(gs)} |' for n, gs in sorted(by_node.items())]
    else:
        out.append('No feature gaps.')
    out += ['', '## Blockers', '', 'A node at `specified` or beyond that leans on one at `idea` or a placeholder.', '']
    if a['blockers']:
        out += ['| Node | Edge | Leans on | Its status |', '|---|---|---|---|']
        out += [f'| {link(ix, page, b["source"])} | `{b["type"]}` | {link(ix, page, b["target"])} | '
                f'{status(ix, b["target"])} |' for b in a['blockers']]
    else:
        out.append('No blockers.')
    out += ['', '## Dangling references', '', 'A reference to an id no file defines.', '']
    if a['dangling']:
        out += ['| From | Names | Read from |', '|---|---|---|']
        out += [f'| {link(ix, page, d["source"])} | `{d["ref"]}` | {d["via"]} |' for d in a['dangling']]
    else:
        out.append('No dangling references.')
    return '\n'.join(out) + '\n'


def orphans_page(ix):
    a, page = ix.data['analysis'], 'orphans.md'
    out = ['# Orphans', '', f'{len(a["orphans"])} nodes with no edge at all, from the parser\'s `analysis`.', '']
    if a['orphans']:
        out += ['| Node | Kind | Status |', '|---|---|---|']
        out += [f'| {link(ix, page, n)} | {ix.nodes[n]["kind"]} | {status(ix, n)} |' for n in a['orphans']]
    else:
        out.append('No orphans.')
    return '\n'.join(out) + '\n'


TAGS_PAGE = '# Tags\n\nEvery page by kind, status and persona.\n\n<!-- material/tags -->\n'


def graph_page(app_built):
    """The ``/graph`` page: the graph app in a frame, or how to build it when ``graph/dist`` is missing."""
    out = ['---', 'hide:', '  - navigation', '  - toc', '---', '', '# Graph', '',
           'Every spec as one graph on `@invana/canvas`, from the same parse as the *Graph* section of each page. '
           'Click a node to see it in the *Element* panel; double-click it, or use *Open spec page*, to open its '
           'page. *Show in graph* on a spec page opens it here, focused.', '']
    if app_built:
        out.append('<iframe class="spec-graph-app"src="app/index.html" title="The spec graph"></iframe>')
    else:
        out += ['!!! warning "The graph app is not built"', '',
                '    Build it once, then build the site again: `pnpm --dir scripts/specs/site/graph install` and '
                '`pnpm --dir scripts/specs/site/graph build`.']
    return '\n'.join(out) + '\n'


# --- MkDocs events ----------------------------------------------------------------------------------------------


def on_config(config, **kwargs):
    global _data
    _data = Index(load())
    return config


def on_files(files, config, **kwargs):
    from mkdocs.structure.files import File

    pages = {'graph.md': graph_page(app_built()), 'loops.md': loops_page(_data), 'gaps.md': gaps_page(_data),
             'orphans.md': orphans_page(_data), 'tags.md': TAGS_PAGE}
    for path in GENERATED:
        files.append(File.generated(config, path, content=pages[path]))
    return files


def on_nav(nav, config, files, **kwargs):
    """Retitle and fold the folder tree (``fold_nav``), then relink parents and previous/next over what is left.

    A ``task.md`` leaves the tree with its story folder: it still builds and its story links to it.
    """
    from mkdocs.structure.pages import Page

    class SectionIndex(Page):
        """A page Material draws as its section's label (``navigation.indexes``), as it does an ``index.md``."""

        is_index = True

    def as_index(page):
        page.__class__ = SectionIndex

    before = nav.pages
    nav.items = fold_nav(_data, nav.items, as_index)
    nav.pages = nav_pages(nav.items)
    kept = set(map(id, nav.pages))
    for page in before:
        if id(page) not in kept:
            page.parent = page.previous_page = page.next_page = None
    _link_nav(nav.items)
    for prev, page, nxt in zip([None, *nav.pages[:-1]], nav.pages, [*nav.pages[1:], None]):
        page.previous_page, page.next_page = prev, nxt
    return nav


def app_built():
    return (GRAPH_APP / 'index.html').is_file()


def on_post_build(config, **kwargs):
    """Copy the graph app into ``<site>/graph/app/`` and write the parse beside it as ``specs-graph.json``."""
    if not app_built():
        return
    target = Path(config['site_dir']) / GRAPH_APP_URL
    shutil.copytree(GRAPH_APP, target, dirs_exist_ok=True)
    (target / 'specs-graph.json').write_text(json.dumps(_data.data), encoding='utf-8')


def on_page_markdown(markdown, page, config, files, **kwargs):
    src = page.file.src_uri
    if src in GENERATED:
        return markdown
    tags = tags_for(_data, src, page.meta)
    if tags:
        page.meta['tags'] = tags
    if is_placeholder_page(_data, src, page.meta):
        markdown = banner(markdown).replace('{gaps}', href(src, 'gaps.md'))
    return markdown + graph_section(_data, src)
