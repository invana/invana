"""Parse ``specs/`` into one typed graph, analyse it, and write the placeholders the graph names.

    python3 scripts/specs/check.py --graph [--out PATH]        # write specs-graph.json (default: the repo root)
    python3 scripts/specs/check.py --placeholders [--write]   # list, and with --write create, missing placeholders

The ``specs/**/*.md`` files are the only source; the graph is a parse of them and is never edited by hand. Every node
and edge comes from front-matter or from structure the parser can read — tables, sections, IDs. A fact the files do
not state is never guessed: a reference to something no file defines is listed in ``analysis.dangling``, and
``--placeholders`` names the stub that would hold it. Every node is one of the kinds below: a markdown file that is
none of them — notes, a README — is not a node, and no folder of free-form design documents is parsed.

Placeholders
------------
A placeholder file carries ``status: placeholder`` in its front-matter; a placeholder section's body starts
``> Placeholder —``; a placeholder NFR row has a cell starting ``Placeholder —``. ``--placeholders`` finds what is
missing and, with ``--write``, creates it — idempotent, and it only ever adds: an existing file or section is never
rewritten.

| Missing | Created by ``--write`` |
|---|---|
| ``specs/system-design.md`` | The file, one placeholder section per row of the system-design template's contents, and in § 3 one placeholder NFR per pillar (``NFR-<PILLAR>-00``) |
| A section or a pillar NFR of an existing ``system-design.md`` | The section, in template order; the NFR row, appended to § 3's table |
| A feature's ``## Engine`` or ``## System impact`` | The section, placed before ``## Decisions`` (format order) |
| A journey named in ``journeys:`` or a journey's ID with no file | ``specs/journeys/J<nn>-placeholder.md`` |
| A board no canvas file draws | Listed only — boards are drawn on the canvas, which is not a spec file |
| A task named in a *Depends on* cell with no row | Listed only — task rows belong to the role that owns them |

JSON schema (``specs-graph.json``)
----------------------------------
Keys and lists are sorted, and nothing depends on the clock, so the same tree always gives the same file. Board
nodes depend on whether the Agent version canvas is built locally (``.design/`` is not in git).

| Key | Holds |
|---|---|
| ``version`` | ``1`` |
| ``counts`` | ``{"nodes": {kind: n}, "edges": {type: n}}`` |
| ``nodes[]`` | ``id`` · ``kind`` · ``title`` · ``path`` (repo-relative file, or ``null``) · ``status`` (the file's or row's status, or ``null``) · ``placeholder`` (bool) · ``product`` (product code, or ``null``) · ``description`` (see *Descriptions*, or ``null``) · ``owner`` (tasks only) · ``journey`` and ``shape`` (steps only: the journey's id; ``decision`` · ``terminal`` · ``step``) · ``columns`` (records only: the column names its *Columns* cell lists, outside parentheses, ``?`` dropped) |
| ``edges[]`` | ``source`` · ``target`` · ``type`` · ``via`` (the key, column or section it was read from) · ``journey`` and ``label`` (``NEXT`` only: the journey whose diagram draws it, and the arrow's label or ``""``) |
| ``analysis.cycles`` | Each strongly connected set of two or more nodes over ``DEPENDS_ON``, as a sorted list of ids |
| ``analysis.chains`` | The longest ``DEPENDS_ON`` chains (three nodes or more, outside cycles), dependent first, longest first |
| ``analysis.blockers`` | ``{source, target, type}``: a node at ``specified`` or beyond that ``DEPENDS_ON`` · ``MUST_MEET`` · ``CHANGES`` a node at ``idea`` or a placeholder |
| ``analysis.orphans`` | Ids of nodes with no edge at all |
| ``analysis.gaps`` | ``{node, gap}`` for a feature: ``no-engine`` · ``placeholder-engine`` · ``no-system-impact`` · ``placeholder-system-impact`` · ``no-nfrs`` |
| ``analysis.dangling`` | ``{source, ref, via}``: a structured reference to an id no file defines, or a row or cell the parser cannot read (``ref`` is its text; ``via`` names the table, e.g. ``Engine Reads``, ``Records _id: no record``, ``Engine Events: owned twice``) |

Node kinds and ids
------------------
| Kind | Id | Read from |
|---|---|---|
| Product · Feature · Story · Journey | its ID (``MO`` · ``MO-F01`` · ``MO-04`` · ``J01``) | its file's front-matter |
| Task | ``MO-04-T1`` | a row of ``task.md`` |
| Persona | ``persona:<key>`` | the first column of ``personas.md`` › *The people* |
| Board | ``board:<name>`` | ``boards:`` keys, story *Screens* cells, task *Boards* cells |
| NFR | ``NFR-<PILLAR>-<n>`` | the table in ``system-design.md`` § 3 |
| DesignSection | ``system-design#<n>`` | a ``## <n>. Title`` heading of ``system-design.md`` |
| Decision | ``<owner id>/D<n>`` | the n-th row of a ``## Decisions`` table, or of a *Decision* table in a design section |
| Step | ``<journey>:<mermaid id>`` (``J03:F``) | a node of a journey's *The journey* flowchart whose label starts with no story id — a decision ``{ }``, a start or end ``([ ])``, a refusal or a plain step; its title is the label |
| Criterion | its ID (``PJ-02.17``) | a row of a story's ``## Acceptance criteria`` table (first header ``#``); title the *Then* cell, description *Given … — When … — Then …*; status and product the story's |
| Record | ``record:<table>`` (``record:projects_tasks``) | a backticked name in the first cell of a feature's ``## Engine`` › *Records* table (first header *Table*); a cell may name several, joined by ``·``; description the *Notes* cell |
| Route | ``route:<METHOD> <whole path>`` (``route:GET /api/v1/u/{u}/{g}/projects``) | each backticked ``METHOD /path`` in the first cell of a *Routes* table; the header's ``after `<prefix>``` is prepended (``/`` alone is the prefix), a path starting ``/api/`` is whole, a query string is dropped; description the *Does* cell |
| Event | ``event:<name>`` (``event:projects.tasks.created``) | each backticked name in the first cell of an *Events* table; a bare name (``assigned``, ``.update``) takes the first name's prefix; description the *When* cell |
| Refusal | ``<feature>/R<n>`` (``PJ-F01/R3``) | the n-th row of the feature's *Refusals* tables (first header *Status*); title *Status · Sentence*, description the *When* cell |

A first cell of ``—`` states there is none and adds nothing. Every Engine-table node takes its feature's file,
status and product. An id two features both define is kept by the first (files in path order), and the second's row is
dangling (``… owned twice``).

Descriptions
------------
| Kind | ``description`` |
|---|---|
| Product · Feature · Story · Journey | The first paragraph under the file's ``# `` title — the blockquote summary, or a story's *As … I want … so that …* — its ``>`` marks dropped and its lines joined |
| Persona | Its *Comes to Invana to* cell in ``personas.md`` › *The people* |
| Criterion · Record · Route · Event · Refusal | As in the node table above |
| Any other | ``null`` |

Edge types
----------
| Type | From → to | Read from |
|---|---|---|
| ``PART_OF`` | Story → Feature · Feature → Product · Task → Story · NFR → DesignSection · Criterion → Story · Event · Refusal → Feature | ``feature:`` · ``product:`` · ``task.md`` · § 3 · *Acceptance criteria* · *Events* · *Refusals* |
| ``OWNS`` | Feature → Record | a row of its *Records* |
| ``READS`` | Feature → Record | a backticked record name in the *Record* cell of a *Reads* row; a row that names no record is dangling (``Engine Reads``) |
| ``REFERENCES`` | Record → Record | a ``<name>_id`` column (``via`` is the column). Read whole, then without leading words (``parent_run_id`` → ``run``); at each length the first rung with exactly one record wins — the table's own child (``agents_skills.version_id`` → ``agents_skill_versions``), its module's (``projects_<name>s``), the bare plural (``graphs``), another module's (``agents_runs``). Two records on a rung, or none at all, is dangling; a column beside a ``<name>_kind`` column names a kind, not a record, and adds nothing. A record naming itself adds no edge |
| ``SERVES_ROUTE`` | Feature → Route | a row of its *Routes* |
| ``EMITS`` | Route → Event | a backticked ``METHOD /path`` in the event row's *Route* column, else its *When* cell, matched by method and the end of the path against the feature's own routes; no match, or several, is dangling |
| ``REFUSES`` | Route → Refusal | the same, from the refusal row's *Route* column, else its *When* cell |
| ``PROVEN_BY`` | Refusal → Criterion | the criterion ids in its *Criterion* cell; a cell that names none and does not start ``API only`` is dangling |
| ``DEPENDS_ON`` | Feature → Feature · Product → Product · Task → Task | ``depends_on:`` · a product's ``## Depends on`` first column, by product title · *Depends on* cells |
| ``SERVES`` | Product · Feature · Story · Journey → Persona | ``personas:`` |
| ``DRAWN_ON`` | Feature · Story · Journey · Task → Board | ``boards:`` · *Screens* · *Boards* |
| ``IN_JOURNEY`` | Story · Feature → Journey | a journey's ``stories:`` · a feature's ``journeys:`` |
| ``MUST_MEET`` | Feature · Story → NFR | ``nfrs:`` · an NFR's *Constrains* cell · NFR ids in ``## System impact`` |
| ``CHANGES`` | Feature → DesignSection | ``§ <n>`` in ``## System impact`` |
| ``DECIDES`` | Decision → the Product, Feature or DesignSection it governs | its table |
| ``NEXT`` | Story · Step → Story · Step | an arrow of a journey's *The journey* flowchart. A diagram node whose label starts with story ids (``"AC-15 · GR-16 · Asks…"``) is those Story nodes — one per story across every journey, which joins the journeys into one graph; two ids are parallel, each taking every arrow in and out. One edge per journey and label |
| ``MENTIONS`` | any → any | an id in prose, where no typed edge already joins the two |
"""
import json
import re
from collections import defaultdict
from pathlib import Path

import check

SKILLS = Path(__file__).resolve().parents[2] / '.claude' / 'skills'
TEMPLATE = SKILLS / 'system-design' / 'template.md'
DESIGN_SKILL = SKILLS / 'system-design' / 'SKILL.md'

PLACEHOLDER = 'placeholder'
MARK = '> Placeholder —'
INLINE_ID = re.compile(r'\b(?:NFR-[A-Z]+-\d+|[A-Z]{2}-F\d{2}|[A-Z]{2}-\d{2,3}-T\d+|[A-Z]{2}-\d{2,3}|J\d{2})\b')
NFR_ID = re.compile(r'^NFR-[A-Z]+-\d+$')
SECTION_HEAD = re.compile(r'^## (\d+)\. (.+?)\s*$', re.M)
LADDER = check.STATUSES
READY = set(LADDER[LADDER.index('specified'):])
BLOCKING = ('DEPENDS_ON', 'MUST_MEET', 'CHANGES')
FEATURE_TAIL = ['Engine', 'System impact', 'Decisions', 'Open questions', 'Not building']
PERSONA_SUMMARY = 'Comes to Invana to'
NONE_CELL = ('', '—', '-')
TICKED = re.compile(r'`([^`]+)`')
RECORD_CELL = re.compile(r'`[a-z][a-z0-9_]*`(?:\s*·\s*`[a-z][a-z0-9_]*`)*')
COLUMN = re.compile(r'[a-z][a-z0-9_]*\??')
ROUTE = re.compile(r'([A-Z]+) (/[^\s?]*)(?:\?.*)?')
EVENT = re.compile(r'[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+')
CRITERION_ID = re.compile(r'[A-Z]{2}-\d{2,3}\.\d+')
API_ONLY = 'API only'
PLACEHOLDER_TEXT = {
    'Engine': 'its records, reads, routes, events, refusals, CLI and mechanisms.',
    'System impact': '`None`, or the `system-design.md` sections it changes and the NFRs it touches.',
}


def rel(path):
    if not path:
        return None
    return str(path.relative_to(check.ROOT)) if path.is_relative_to(check.ROOT) else str(path)


def is_placeholder_text(text):
    return text.strip().startswith(MARK)


class Graph:
    """Nodes and edges as they are parsed, with the references nothing defines."""

    def __init__(self):
        self.nodes, self.edges, self.dangling = {}, {}, []

    def node(self, nid, kind, title='', path=None, status=None, placeholder=False, product=None, description=None,
             **extra):
        if nid not in self.nodes:
            self.nodes[nid] = {'id': nid, 'kind': kind, 'title': title, 'path': rel(path), 'status': status,
                               'placeholder': placeholder, 'product': product, 'description': description, **extra}
        return self.nodes[nid]

    def unread(self, source, ref, via):
        """A row, or a cell of one, the parser cannot read: listed in ``analysis.dangling``, never dropped."""
        self.dangling.append({'source': source, 'ref': ref, 'via': via})

    def edge(self, source, target, etype, via, **extra):
        """One edge per ``(source, target, type)`` and extra fields — a ``NEXT`` edge is one per journey and label."""
        if source != target:
            self.edges.setdefault((source, target, etype, tuple(sorted(extra.items()))), via)

    def ref(self, source, target, etype, via):
        """An edge to ``target`` if a node defines it, else a dangling reference."""
        if target in self.nodes:
            self.edge(source, target, etype, via)
        else:
            self.dangling.append({'source': source, 'ref': target, 'via': via})

    def joined(self):
        return {frozenset((s, t)) for s, t, *_ in self.edges}


def specs_files():
    """``(path, kind, front-matter, body)`` of every live spec file the checker knows."""
    out = []
    for path in sorted(check.SPECS.rglob('*.md')):
        if check.is_stale(path):
            continue
        kind = check.kind_of(path)
        if kind in (None, 'task'):
            continue
        fm, body = check.front_matter(path, path.read_text())
        out.append((path, kind, fm, body))
    return out


def is_ph(fm):
    return fm.get('status') == PLACEHOLDER


def decision_rows(text):
    """Rows of the tables in ``text`` whose header's first cell is *Decision*: ``(title, whole row)``."""
    rows, in_table = [], False
    for line in text.splitlines():
        if not line.startswith('|'):
            in_table = False
            continue
        if re.match(r'^\|[-| :]+\|\s*$', line):
            continue
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if not in_table:
            in_table = cells[0] == 'Decision'
            continue
        if cells[0] and cells[0] not in ('—', '-'):
            rows.append((cells[0], line))
    return rows


def build():
    """Parse the tree into a :class:`Graph`."""
    g = Graph()
    files = specs_files()
    prose = []  # (source id, text) scanned last for MENTIONS

    personas = check.SPECS / 'personas.md'
    if personas.exists():
        for header, rows in tables(check.section(personas.read_text(), 'The people')):
            why = header.index(PERSONA_SUMMARY) if PERSONA_SUMMARY in header else None
            for r in rows:
                key = r[0].strip('`* ')
                if r[0].startswith('`'):
                    g.node(f'persona:{key}', 'Persona',
                           r[1].strip('*').split('**')[0].strip() if len(r) > 1 else key, personas,
                           description=r[why] if why is not None and why < len(r) and r[why] else None)

    kinds = {'product': 'Product', 'feature': 'Feature', 'story': 'Story', 'journey': 'Journey'}
    for path, kind, fm, body in files:
        product = {'product': fm.get('id'), 'feature': fm.get('product'),
                   'story': fm.get('feature', '').split('-')[0] or None}.get(kind)
        g.node(fm.get('id', rel(path)), kinds[kind], fm.get('title', ''), path, fm.get('status'), is_ph(fm), product,
               summary(body))

    # The system design: sections, NFRs, their decisions.
    sd = check.SPECS / 'system-design.md'
    if sd.exists():
        raw = sd.read_text()
        sfm, sbody = check.front_matter(sd, raw) if raw.startswith('---\n') else ({}, raw)
        heads = list(SECTION_HEAD.finditer(sbody))
        for i, m in enumerate(heads):
            text = sbody[m.end():heads[i + 1].start() if i + 1 < len(heads) else len(sbody)]
            sid = f'system-design#{m.group(1)}'
            ph = is_placeholder_text(text)
            g.node(sid, 'DesignSection', f'{m.group(1)}. {m.group(2)}', sd, PLACEHOLDER if ph else sfm.get('status'), ph)
            if m.group(1) == '3':
                for r in check.table_rows(text):
                    if not NFR_ID.match(r[0]):
                        continue
                    nph = any(c.startswith('Placeholder —') for c in r[1:])
                    g.node(r[0], 'NFR', r[1] if len(r) > 1 else '', sd, PLACEHOLDER if nph else None, nph)
                    g.edge(r[0], sid, 'PART_OF', 'system-design §3')
                    for t in INLINE_ID.findall(r[5] if len(r) >= 6 else ''):
                        reverse_ref(g, r[0], t, 'MUST_MEET', 'NFR Constrains')
            for n, (title, line) in enumerate(decision_rows(text), 1):
                did = f'{sid}/D{n}'
                g.node(did, 'Decision', title, sd, PLACEHOLDER if ph else None, ph)
                g.edge(did, sid, 'DECIDES', 'Decision table')
                prose.append((did, line))
            prose.append((sid, text))

    titles = {fm.get('title', '').lower(): fm['id'] for _, k, fm, _ in files if k == 'product' and 'id' in fm}
    for path, kind, fm, body in files:
        nid = fm.get('id', rel(path))
        if kind == 'story' and fm.get('feature'):
            g.ref(nid, fm['feature'], 'PART_OF', 'feature')
        if kind == 'feature' and fm.get('product'):
            g.ref(nid, fm['product'], 'PART_OF', 'product')
        for dep in fm.get('depends_on', []):
            g.ref(nid, dep, 'DEPENDS_ON', 'depends_on')
        if kind == 'product':
            for r in check.table_rows(check.section(body, 'Depends on'))[1:]:
                target = titles.get(r[0].split('›')[0].strip().lower())
                if target:
                    g.edge(nid, target, 'DEPENDS_ON', 'Depends on')
        for p in fm.get('personas', []):
            g.ref(nid, f'persona:{p}', 'SERVES', 'personas')
        boards = list(fm.get('boards', []))
        if kind == 'story':
            for r in check.table_rows(check.section(body, 'Screens'))[1:]:
                boards += [c.split(' · ')[0].strip('` ') for c in r[2:] if c not in ('—', '-', '')]
        for b in dict.fromkeys(boards):
            board(g, b)
            g.edge(nid, f'board:{b}', 'DRAWN_ON', 'boards')
        if kind == 'journey':
            for s in fm.get('stories', []):
                reverse_ref(g, nid, s, 'IN_JOURNEY', 'journey stories')
            journey_steps(g, nid, body, path)
        for j in fm.get('journeys', []):
            g.ref(nid, j, 'IN_JOURNEY', 'journeys')
        for n in fm.get('nfrs', []):
            g.ref(nid, n, 'MUST_MEET', 'nfrs')
        if kind == 'feature':
            impact = check.section(body, 'System impact')
            if not is_placeholder_text(impact):
                for s in sorted(set(re.findall(r'§\s*(\d+)', impact))):
                    g.ref(nid, f'system-design#{s}', 'CHANGES', 'System impact')
                for n in sorted(set(re.findall(r'NFR-[A-Z]+-\d+', impact))):
                    g.ref(nid, n, 'MUST_MEET', 'System impact')
        own_decisions = ''
        if kind in ('product', 'feature'):
            own_decisions = check.section(body, 'Decisions')
            for n, (title, line) in enumerate(decision_rows(own_decisions), 1):
                did = f'{nid}/D{n}'
                g.node(did, 'Decision', title, path, fm.get('status'), False, g.nodes[nid]['product'])
                g.edge(did, nid, 'DECIDES', 'Decisions')
                prose.append((did, line))
        if kind == 'story':
            tasks(g, path.parent / 'task.md', nid, g.nodes[nid]['product'])
        prose.append((nid, body.replace(own_decisions, '') if own_decisions else body))

    for path, kind, fm, body in files:
        if kind == 'story' and 'id' in fm:
            criteria(g, fm['id'], body, path)
    engine(g, [(path, fm, body) for path, kind, fm, body in files if kind == 'feature' and 'id' in fm])

    joined = g.joined()
    for source, text in prose:
        for t in dict.fromkeys(INLINE_ID.findall(text)):
            if t in g.nodes and t != source and frozenset((source, t)) not in joined:
                g.edge(source, t, 'MENTIONS', 'prose')
    return g


def reverse_ref(g, holder, ref, etype, via):
    """An edge ``ref → holder`` read from ``holder``'s file; a dangling reference when ``ref`` is undefined."""
    if ref in g.nodes:
        g.edge(ref, holder, etype, via)
    else:
        g.dangling.append({'source': holder, 'ref': ref, 'via': via})


def journey_steps(g, jid, body, path):
    """``NEXT`` edges, and the ``Step`` nodes no story stands for, from a journey's *The journey* flowchart.

    A diagram node whose label starts with story ids stands for those stories — the same node in every journey, which
    is what joins the journeys into one graph; two ids on one node are parallel, so each takes every edge in and out.
    Any other node is a ``Step`` of this journey, ``<journey>:<mermaid id>``. An id that names no story is dangling,
    and a node whose ids all dangle stays a ``Step`` so the path through it is kept.
    """
    nodes, edges = check.journey_flow(body)
    ends = {}
    for mid, (label, shape) in nodes.items():
        stories = []
        for sid in check.lead_ids(label):
            if g.nodes.get(sid, {}).get('kind') == 'Story':
                stories.append(sid)
            else:
                g.dangling.append({'source': jid, 'ref': sid, 'via': 'journey diagram'})
        if not stories:
            step = f'{jid}:{mid}'
            g.node(step, 'Step', label, path, None, False, None, journey=jid, shape=shape)
            stories = [step]
        ends[mid] = stories
    for source, target, label in edges:
        for a in ends[source]:
            for b in ends[target]:
                g.edge(a, b, 'NEXT', 'The journey', journey=jid, label=label)


def board(g, name):
    """Add a board node, a placeholder when the canvas is built and does not draw it."""
    nid = f'board:{name}'
    if nid in g.nodes:
        return
    drawn = check.CANVAS / f'{name}.dc.html'
    built = check.CANVAS.exists()
    g.node(nid, 'Board', name, drawn if built and drawn.exists() else None,
           ('drawn' if drawn.exists() else PLACEHOLDER) if built else None, built and not drawn.exists())


def tasks(g, path, sid, product):
    """Task nodes from one ``task.md``, with their story, boards and dependencies."""
    if not path.exists():
        return
    rows = check.table_rows(path.read_text())
    if not rows or rows[0] != check.TASK_COLUMNS:
        return
    parsed = [dict(zip(check.TASK_COLUMNS, r)) for r in rows[1:] if len(r) == len(check.TASK_COLUMNS)]
    for t in parsed:
        g.node(t['ID'], 'Task', t['Title'], path, t['Status'], False, product, owner=t['Owner'])
        g.edge(t['ID'], sid, 'PART_OF', 'task.md')
        for b in re.split(r'\s*·\s*', t['Boards'].strip('` ')):
            b = b.strip('` ')
            if b and b not in ('—', '-'):
                board(g, b)
                g.edge(t['ID'], f'board:{b}', 'DRAWN_ON', 'Boards')
    for t in parsed:
        for dep in re.findall(r'[A-Z]{2}-\d{2,3}-T\d+', t['Depends on']):
            g.ref(t['ID'], dep, 'DEPENDS_ON', 'Depends on')


# --- descriptions, criteria and the Engine tables ----------------------------------------------------------------


def summary(body):
    """The summary under a file's ``# `` title: its first paragraph, a blockquote's ``>`` marks dropped, or ``None``."""
    m = re.search(r'^# .*$', body, re.M)
    if not m:
        return None
    lines = []
    for line in body[m.end():].lstrip('\n').splitlines():
        if not line.strip() or line.startswith(('#', '|', '```')):
            break
        lines.append(re.sub(r'^>\s?', '', line).strip())
    return ' '.join(lines).strip() or None


def tables(text):
    """Each markdown table in ``text`` as ``(header cells, data rows)``."""
    out, current = [], None
    for line in text.splitlines():
        if not line.startswith('|'):
            current = None
            continue
        if re.match(r'^\|[-| :]+\|\s*$', line):
            continue
        inner = line.strip().removeprefix('|').removesuffix('|')
        cells = [c.strip().replace('\\|', '|') for c in re.split(r'(?<!\\)\|', inner)]
        if current is None:
            current = (cells, [])
            out.append(current)
        else:
            current[1].append(cells)
    return out


def subsection(text, name):
    """The body of ``### <name>`` in ``text``, up to the next ``###`` or higher heading, or ``''``."""
    m = re.search(rf'^### {re.escape(name)}\s*$', text, re.M)
    if not m:
        return ''
    end = re.search(r'^#{1,3} ', text[m.end():], re.M)
    return text[m.end():m.end() + end.start() if end else len(text)]


def cell(row, header, name):
    """The cell of ``row`` under the column ``name``, or ``''``."""
    i = header.index(name) if name in header else -1
    return row[i] if 0 <= i < len(row) else ''


def plain(text):
    """``text`` without the emphasis marks of a table cell."""
    return re.sub(r'(?<!\w)\*+|\*+(?!\w)', '', text).strip()


def criteria(g, sid, body, path):
    """``Criterion`` nodes, each ``PART_OF`` its story, from the story's *Acceptance criteria* table."""
    story = g.nodes[sid]
    for header, rows in tables(check.section(body, 'Acceptance criteria')):
        if header[0] != '#':
            continue
        for r in rows:
            if not CRITERION_ID.fullmatch(r[0]):
                g.unread(sid, r[0], 'Acceptance criteria')
                continue
            if r[0] in g.nodes:
                g.unread(sid, r[0], 'Acceptance criteria: defined twice')
                continue
            parts = [f'{h} {cell(r, header, h)}' for h in header[1:] if cell(r, header, h)]
            g.node(r[0], 'Criterion', plain(cell(r, header, 'Then')) or r[0], path, story['status'], False,
                   story['product'], ' — '.join(parts) or None)
            g.edge(r[0], sid, 'PART_OF', 'Acceptance criteria')


def engine(g, features):
    """Record, Route, Event and Refusal nodes and their edges from every feature's ``## Engine`` tables.

    Each subsection is read by its table's first header cell — *Table* (Records), *Record* (Reads), *Route…*
    (Routes), *Event* (Events), *Status* (Refusals) — and a row is one entity named in backticks in its first column.
    A first cell of ``—`` states there is none. Any other row the parser cannot read, and a reference it cannot
    resolve to exactly one node, is listed in ``analysis.dangling`` with the subsection it came from.
    """
    parsed = []
    for path, fm, body in features:
        eng = check.section(body, 'Engine')
        if not eng or is_placeholder_text(eng):
            continue
        fid = fm['id']
        meta = (path, g.nodes[fid]['status'], False, g.nodes[fid]['product'])
        routes = engine_routes(g, fid, subsection(eng, 'Routes'), meta)
        parsed.append((fid, eng, meta, routes))
        engine_records(g, fid, subsection(eng, 'Records'), meta)
    for fid, eng, meta, routes in parsed:
        engine_events(g, fid, subsection(eng, 'Events'), meta, routes)
        engine_refusals(g, fid, subsection(eng, 'Refusals'), meta, routes)
        engine_reads(g, fid, subsection(eng, 'Reads'))
    record_references(g)


def engine_records(g, fid, text, meta):
    """``Record`` nodes the feature ``OWNS``; their columns are the backticked names outside parentheses."""
    for header, rows in tables(text):
        if header[0] != 'Table':
            continue
        for r in rows:
            if r[0] in NONE_CELL:
                continue
            if not RECORD_CELL.fullmatch(r[0]):
                g.unread(fid, r[0], 'Engine Records')
                continue
            outside = re.sub(r'\([^()]*\)', '', cell(r, header, 'Columns'))
            columns = [c.rstrip('?') for c in TICKED.findall(outside) if COLUMN.fullmatch(c)]
            for name in TICKED.findall(r[0]):
                rid = f'record:{name}'
                if rid in g.nodes:
                    g.unread(fid, rid, 'Engine Records: owned twice')
                    continue
                g.node(rid, 'Record', name, *meta, cell(r, header, 'Notes') or None, columns=columns)
                g.edge(fid, rid, 'OWNS', 'Records')


def full_path(prefix, path):
    """A route's whole path: ``path`` under its table's ``after`` prefix, unless it is already whole."""
    if not prefix or path.startswith('/api/'):
        return path
    return prefix if path == '/' else prefix + path


def engine_routes(g, fid, text, meta):
    """``Route`` nodes the feature ``SERVES_ROUTE``, one per ``METHOD /path`` in a first cell. Returns their ids."""
    own = []
    for header, rows in tables(text):
        if not header[0].startswith('Route'):
            continue
        m = re.search(r'after `([^`]+)`', header[0])
        prefix = m.group(1).rstrip('/') if m else ''
        for r in rows:
            if r[0] in NONE_CELL:
                continue
            items = TICKED.findall(r[0])
            routes = [ROUTE.fullmatch(i) for i in items]
            if not items or not all(routes):
                g.unread(fid, r[0], 'Engine Routes')
                continue
            for route in routes:
                rid = f'route:{route.group(1)} {full_path(prefix, route.group(2))}'
                if rid in g.nodes:
                    g.unread(fid, rid, 'Engine Routes: owned twice')
                    continue
                g.node(rid, 'Route', rid.removeprefix('route:'), *meta, cell(r, header, 'Does') or None)
                g.edge(fid, rid, 'SERVES_ROUTE', 'Routes')
                own.append(rid)
    return own


def named_routes(g, source, text, routes, via):
    """The feature's routes a cell names in backticks (``POST /register``), matched by method and the path's end.

    A named route that matches none, or more than one, of ``routes`` is dangling.
    """
    out = []
    for item in TICKED.findall(text):
        m = ROUTE.fullmatch(item)
        if not m:
            continue
        method, path = m.groups()
        hits = [r for r in routes if r.startswith(f'route:{method} /') and r.endswith(path)]
        if len(hits) == 1:
            out.append(hits[0])
        else:
            g.unread(source, item, via)
    return out


def engine_events(g, fid, text, meta, routes):
    """``Event`` nodes, each ``PART_OF`` the feature; a route the *Route* column or the *When* cell names ``EMITS`` it.

    A cell ``projects.tasks.created`` · ``assigned`` names two events: a bare name takes the first name's prefix.
    """
    for header, rows in tables(text):
        if header[0] != 'Event':
            continue
        for r in rows:
            if r[0] in NONE_CELL:
                continue
            names = TICKED.findall(r[0])
            base = names[0].rpartition('.')[0] if names and '.' in names[0].lstrip('.') else ''
            events = [names[0]] + [n if '.' in n.lstrip('.') else f'{base}.{n.lstrip(".")}' for n in names[1:]]
            if not events or not base or not all(EVENT.fullmatch(e) for e in events):
                g.unread(fid, r[0], 'Engine Events')
                continue
            when = cell(r, header, 'When')
            emitters = named_routes(g, fid, cell(r, header, 'Route') or when, routes, 'Engine Events route')
            for name in events:
                eid = f'event:{name}'
                if eid in g.nodes:
                    g.unread(fid, eid, 'Engine Events: owned twice')
                    continue
                g.node(eid, 'Event', name, *meta, when or None)
                g.edge(eid, fid, 'PART_OF', 'Events')
                for rid in emitters:
                    g.edge(rid, eid, 'EMITS', 'Events')


def engine_refusals(g, fid, text, meta, routes):
    """``Refusal`` nodes ``<feature>/R<n>``, each ``PART_OF`` the feature and ``PROVEN_BY`` its criteria.

    A route the *Route* column or the *When* cell names ``REFUSES`` it. A *Criterion* cell names criterion ids, or
    starts ``API only`` and says why no person meets it; anything else is dangling.
    """
    n = 0
    for header, rows in tables(text):
        if header[0] != 'Status':
            continue
        for r in rows:
            if r[0] in NONE_CELL:
                continue
            n += 1
            rid = f'{fid}/R{n}'
            when = cell(r, header, 'When')
            g.node(rid, 'Refusal', f'{plain(r[0])} · {plain(cell(r, header, "Sentence"))}', *meta, when or None)
            g.edge(rid, fid, 'PART_OF', 'Refusals')
            proof = cell(r, header, 'Criterion')
            ids = re.findall(CRITERION_ID.pattern, proof)
            for c in dict.fromkeys(ids):
                g.ref(rid, c, 'PROVEN_BY', 'Criterion')
            if not ids and not proof.startswith(API_ONLY):
                g.unread(rid, proof, 'Engine Refusals Criterion')
            for route in named_routes(g, rid, cell(r, header, 'Route') or when, routes, 'Engine Refusals route'):
                g.edge(route, rid, 'REFUSES', 'Refusals')


def engine_reads(g, fid, text):
    """``READS`` edges to the records a *Reads* row names in backticks; a row that names none is dangling."""
    for header, rows in tables(text):
        if header[0] != 'Record':
            continue
        for r in rows:
            if r[0] in NONE_CELL:
                continue
            named = [f'record:{n}' for n in TICKED.findall(r[0]) if f'record:{n}' in g.nodes]
            for rid in dict.fromkeys(named):
                g.edge(fid, rid, 'READS', 'Reads')
            if not named:
                g.unread(fid, r[0], 'Engine Reads')


def plurals(word):
    return {word + 's', word + 'es', word[:-1] + 'ies' if word.endswith('y') else word + 's'}


def singulars(name):
    return {name[:-1]} | ({name[:-2]} if name.endswith('es') else set()) | (
        {name[:-3] + 'y'} if name.endswith('ies') else set())


def resolve_column(table, column, columns, records):
    """The record a ``<name>_id`` column of ``table`` names, ``None`` when it names a kind, or a reason it cannot.

    The name is read whole, then without its leading words (``parent_run_id`` → ``run``), and at each length the
    first of these that holds exactly one record wins: a table of ``table``'s own rows (``agents_skills`` ·
    ``version_id`` → ``agents_skill_versions``), the same module (``projects_task_claims`` · ``task_id`` →
    ``projects_tasks``), a table named the bare plural (``graphs``), another module's (``agents_runs``). Two at one
    rung is ambiguous. A column beside a ``<name>_kind`` column names a kind and an id, not a record.
    """
    stem = column[:-len('_id')]
    if f'{stem}_kind' in columns:
        return None, None
    words, module = stem.split('_'), table.split('_')[0]
    for i in range(len(words)):
        ps = plurals('_'.join(words[i:]))
        rungs = ({f'{s}_{p}' for s in singulars(table) for p in ps}, {f'{module}_{p}' for p in ps}, ps,
                 {t for t in records if '_' in t and t.split('_', 1)[1] in ps})
        for rung in rungs:
            hits = sorted(rung & records)
            if len(hits) == 1:
                return hits[0], None
            if hits:
                return None, 'Records _id: several records'
    return None, 'Records _id: no record'


def record_references(g):
    """``REFERENCES`` edges from each record's ``_id`` columns (see :func:`resolve_column`)."""
    records = {n['title'] for n in g.nodes.values() if n['kind'] == 'Record'}
    for name in sorted(records):
        rid = f'record:{name}'
        columns = g.nodes[rid]['columns']
        for column in columns:
            if not column.endswith('_id'):
                continue
            target, why = resolve_column(name, column, columns, records)
            if target:
                g.edge(rid, f'record:{target}', 'REFERENCES', column)
            elif why:
                g.unread(rid, column, why)


def scc(nodes, adj):
    """Tarjan's strongly connected components, iteratively."""
    index, low, on, stack, out, counter = {}, {}, set(), [], [], [0]
    for root in nodes:
        if root in index:
            continue
        work = [(root, iter(adj[root]))]
        index[root] = low[root] = counter[0]
        counter[0] += 1
        stack.append(root)
        on.add(root)
        while work:
            v, it = work[-1]
            w = next(it, None)
            if w is not None:
                if w not in index:
                    index[w] = low[w] = counter[0]
                    counter[0] += 1
                    stack.append(w)
                    on.add(w)
                    work.append((w, iter(adj[w])))
                elif w in on:
                    low[v] = min(low[v], index[w])
                continue
            work.pop()
            if work:
                low[work[-1][0]] = min(low[work[-1][0]], low[v])
            if low[v] == index[v]:
                comp = []
                while True:
                    w = stack.pop()
                    on.discard(w)
                    comp.append(w)
                    if w == v:
                        break
                out.append(sorted(comp))
    return out


def analyse(g):
    """Cycles, blocking chains, blockers, orphans and gaps — computed here so the site never recomputes them."""
    adj = defaultdict(list)
    deps = sorted({(s, t) for s, t, e, _ in g.edges if e == 'DEPENDS_ON'})
    for s, t in deps:
        adj[s].append(t)
    dep_nodes = sorted({n for e in deps for n in e})
    cycles = sorted(c for c in scc(dep_nodes, adj) if len(c) > 1)
    cyclic = {n for c in cycles for n in c}

    longest = {}

    def path_from(n):
        if n not in longest:
            best = []
            for t in sorted(adj[n]):
                if t not in cyclic:
                    p = path_from(t)
                    if len(p) > len(best):
                        best = p
            longest[n] = [n] + best
        return longest[n]

    has_dependent = {t for _, t in deps}
    chains = [path_from(n) for n in dep_nodes if n not in cyclic and n not in has_dependent]
    chains = sorted((c for c in chains if len(c) >= 3), key=lambda c: (-len(c), c))[:20]

    def low(n):
        return n['placeholder'] or n['status'] in ('idea', PLACEHOLDER)

    blockers = sorted(({'source': s, 'target': t, 'type': e} for s, t, e, _ in g.edges
                       if e in BLOCKING and g.nodes[s]['status'] in READY and low(g.nodes[t])),
                      key=lambda b: (b['source'], b['target'], b['type']))
    touched = {n for s, t, *_ in g.edges for n in (s, t)}
    orphans = sorted(n for n in g.nodes if n not in touched)

    gaps = []
    for nid, n in sorted(g.nodes.items()):
        if n['kind'] != 'Feature' or n['placeholder']:
            continue
        fm, body = check.front_matter(check.ROOT / n['path'], (check.ROOT / n['path']).read_text())
        for name, slug in (('Engine', 'engine'), ('System impact', 'system-impact')):
            if name not in check.sections(body):
                gaps.append({'node': nid, 'gap': f'no-{slug}'})
            elif is_placeholder_text(check.section(body, name)):
                gaps.append({'node': nid, 'gap': f'placeholder-{slug}'})
        if 'nfrs' not in fm:
            gaps.append({'node': nid, 'gap': 'no-nfrs'})
    dangling = sorted({(d['source'], d['ref'], d['via']) for d in g.dangling})
    return {'cycles': cycles, 'chains': chains, 'blockers': blockers, 'orphans': orphans, 'gaps': gaps,
            'dangling': [{'source': s, 'ref': r, 'via': v} for s, r, v in dangling]}


def to_json(g):
    nodes = [g.nodes[k] for k in sorted(g.nodes)]
    edges = [{'source': s, 'target': t, 'type': e, 'via': v, **dict(x)} for (s, t, e, x), v in sorted(g.edges.items())]
    counts = {'nodes': dict(sorted(_count(n['kind'] for n in nodes).items())),
              'edges': dict(sorted(_count(e['type'] for e in edges).items()))}
    return {'version': 1, 'counts': counts, 'nodes': nodes, 'edges': edges, 'analysis': analyse(g)}


def _count(items):
    out = defaultdict(int)
    for i in items:
        out[i] += 1
    return out


def write_graph(out=None):
    """Write the graph to ``out`` (default ``specs-graph.json`` at the repo root); returns the data."""
    data = to_json(build())
    out = Path(out) if out else check.ROOT / 'specs-graph.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    c = data['counts']
    a = data['analysis']
    print(f'{out}: {sum(c["nodes"].values())} nodes · {sum(c["edges"].values())} edges · {len(a["cycles"])} cycles · '
          f'{len(a["chains"])} chains · {len(a["blockers"])} blockers · {len(a["orphans"])} orphans · '
          f'{len(a["gaps"])} gaps · {len(a["dangling"])} dangling')
    return data


# --- placeholders -----------------------------------------------------------------------------------------------


def design_sections():
    """``[(n, title, answers)]`` from the contents table of the system-design template."""
    out = []
    for r in check.table_rows(TEMPLATE.read_text().split('\n## ', 1)[0]):
        m = re.match(r'\[(.+?)\]', r[1]) if len(r) == 3 else None
        if m and r[0].isdigit():
            out.append((int(r[0]), m.group(1), r[2]))
    if not out:
        raise SystemExit(f'no contents table in {TEMPLATE}')
    return out


def pillars():
    """``[(code, name)]`` from the system-design skill's ``Pillars:`` line."""
    m = re.search(r'Pillars: (.+?)\. An ID', DESIGN_SKILL.read_text())
    if not m:
        raise SystemExit(f'no `Pillars:` line in {DESIGN_SKILL}')
    return [(c, n.strip().capitalize()) for c, n in re.findall(r'`([A-Z]+)` ([a-z ]+)', m.group(1))]


NFR_HEAD = '| ID | Quality | Target | Measured by | Enforced by | Constrains |\n|---|---|---|---|---|---|'


def nfr_row(code, name):
    return f'| NFR-{code}-00 | {name} | Placeholder — not set | — | — | — |'


def section_text(n, title, answers, nfr_rows=()):
    text = f'## {n}. {title}\n\n{MARK} {answers[0].lower() + answers[1:]}.\n'
    if nfr_rows:
        text += '\n' + NFR_HEAD + '\n' + '\n'.join(nfr_rows) + '\n'
    return text


def insert_before(text, block, heads):
    """``text`` with ``block`` inserted before the first heading line in ``heads`` it holds, else appended."""
    for h in heads:
        m = re.search(rf'^{h}', text, re.M)
        if m:
            return text[:m.start()] + block + '\n' + text[m.start():]
    return text.rstrip('\n') + '\n\n' + block


def plan_placeholders():
    """Every missing placeholder: ``[(action, path, what, new text or None)]``. ``None`` means list only."""
    actions = []
    sd = check.SPECS / 'system-design.md'
    secs, pils = design_sections(), pillars()
    if not sd.exists():
        body = ''.join(section_text(n, t, a, [nfr_row(*p) for p in pils] if n == 3 else ()) + '\n' for n, t, a in secs)
        text = (f'---\ntitle: System design\nstatus: {PLACEHOLDER}\n---\n\n# System design\n\n'
                f'{MARK} the high-level design and the non-functional requirements.\n\n{body}').rstrip('\n') + '\n'
        actions.append(('create', sd, f'{len(secs)} sections · {len(pils)} NFRs', text))
    else:
        text = original = sd.read_text()
        added = []
        for i, (n, t, a) in enumerate(secs):
            if not re.search(rf'^## {n}\. ', text, re.M):
                text = insert_before(text, section_text(n, t, a), [rf'## {m}\. ' for m, _, _ in secs[i + 1:]])
                added.append(f'§{n}')
        m3 = re.search(r'^## 3\. .*$', text, re.M)
        if m3:
            end = text.find('\n## ', m3.end())
            end = len(text) if end < 0 else end
            s3 = text[m3.end():end]
            missing = [p for p in pils if not re.search(rf'^\| NFR-{p[0]}-\d+ ', s3, re.M)]
            if missing:
                rows = '\n'.join(nfr_row(*p) for p in missing)
                lines = s3.rstrip('\n').split('\n')
                if any(line.startswith('| ID |') for line in lines):
                    last = max(i for i, line in enumerate(lines) if line.startswith('|'))
                    lines.insert(last + 1, rows)
                    s3 = '\n'.join(lines) + '\n\n'
                else:
                    s3 = s3.rstrip('\n') + '\n\n' + NFR_HEAD + '\n' + rows + '\n\n'
                text = text[:m3.end()] + s3 + text[end:].lstrip('\n')
                added += [f'NFR-{c}-00' for c, _ in missing]
        if text != original:
            actions.append(('add', sd, ' · '.join(added), text))

    files = specs_files()
    for path, kind, fm, body in files:
        if kind != 'feature' or is_ph(fm):
            continue
        text = original = path.read_text()
        added = []
        for i, name in enumerate(FEATURE_TAIL[:2]):
            if not re.search(rf'^## {name}\s*$', text, re.M):
                block = f'## {name}\n\n{MARK} {PLACEHOLDER_TEXT[name]}\n'
                text = insert_before(text, block, [rf'## {h}\s*$' for h in FEATURE_TAIL[i + 1:]])
                added.append(f'## {name}')
        if text != original:
            actions.append(('add', path, ' · '.join(added), text))

    g = build()
    journeys = sorted({d['ref'] for d in g.dangling if re.fullmatch(r'J\d{2}', d['ref'])})
    for j in journeys:
        by = sorted({d['source'] for d in g.dangling if d['ref'] == j})
        path = check.SPECS / 'journeys' / f'{j}-placeholder.md'
        if not path.exists():
            actions.append(('create', path, f'named by {", ".join(by)}',
                            f'---\nid: {j}\ntitle: Placeholder\nstatus: {PLACEHOLDER}\npersonas: []\nstories: []\n'
                            f'boards: []\n---\n\n# {j} · Placeholder\n\n{MARK} named by {", ".join(by)}; '
                            'nothing in it is decided yet.\n'))
    for d in sorted({(d['source'], d['ref']) for d in g.dangling if re.fullmatch(r'[A-Z]{2}-\d{2,3}-T\d+', d['ref'])}):
        actions.append(('list', None, f'task `{d[1]}` named by {d[0]} has no row — its owner adds it', None))
    for nid, n in sorted(g.nodes.items()):
        if n['kind'] == 'Board' and n['placeholder']:
            actions.append(('list', None, f'board `{n["title"]}` is not drawn — the designer draws it', None))
    return actions


def placeholders(write=False):
    """Print, and with ``write`` apply, every missing placeholder. Returns 0."""
    actions = plan_placeholders()
    for action, path, what, text in actions:
        where = rel(path) if path else ''
        if action == 'list':
            print(f'list    {what}')
            continue
        print(f'{action if write else "would " + action:<13} {where} — {what}')
        if write:
            path.parent.mkdir(parents=True, exist_ok=True)
            if action == 'create' and path.exists():
                continue
            path.write_text(text)
    files = sum(1 for a in actions if a[0] != 'list')
    print(f'{files} files {"written" if write else "to write"} · {len(actions) - files} listed only')
    return 0
