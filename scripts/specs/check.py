"""Check every product spec in specs/ against the standard format, and build its index.

    python3 scripts/specs/check.py            # check; exit 1 on any error
    python3 scripts/specs/check.py --index    # check, then rewrite specs/README.md

The format is .claude/skills/product-spec/format.md. This script enforces the mechanical half of it — front-matter,
required sections, IDs, story shape, the task table, cross-links, screen words and the no-history rule — so the
product-manager agent and its reviewers can spend their judgment on what the spec says.

A spec area is a product (``products/<p>/``) or a part of the foundation every product uses (``foundation/<p>/``),
both written the same way. A feature is a folder, ``<area>/<p>/features/<CODE>-F<nn>-<slug>/feature.md``; each of its
stories is a folder under
``stories/<CODE>-<nn>-<slug>/`` holding ``story.md`` and ``task.md``. A story's status may not run ahead of its tasks,
and a feature's status is the lowest of its stories'. Boards are checked against the Agent version canvas when it is
built locally (`.design/` is not in git); without it the board check is skipped and says so.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPECS = ROOT / 'specs'
CANVAS = ROOT / '.design' / 'canvas-agent-version' / 'project'

AREAS = {'products': 'Products', 'foundation': 'Foundation'}
STATUSES = ['idea', 'specified', 'designed', 'built', 'verified']
KEYS = {
    'product': ['id', 'title', 'status', 'owner', 'personas'],
    'feature': ['id', 'title', 'product', 'status', 'personas', 'stories', 'journeys', 'boards', 'depends_on'],
    'story': ['id', 'title', 'feature', 'status', 'personas', 'boards'],
    'journey': ['id', 'title', 'personas', 'stories', 'boards'],
}
SECTIONS = {
    'product': ['Problem', 'Users', 'Goals', 'Features', 'Surfaces', 'Decisions', 'Depends on', 'Not building'],
    'feature': ['User journey', 'Stories', 'Rules', 'Access', 'States', 'Data touched', 'Decisions', 'Open questions', 'Not building'],
    'story': ['Who can', 'Flow', 'Acceptance criteria', 'Screens'],
    'journey': ['The journey', 'Steps', 'Branches', 'Done when'],
}
TASK_COLUMNS = ['ID', 'Owner', 'Title', 'Description', 'Story', 'Criteria', 'Boards', 'Depends on', 'Status', 'Evidence']
OWNERS = ['designer', 'coder', 'qa']
TASK_STATUSES = ['todo', 'doing', 'blocked', 'done', 'dropped']
GATE_OWNER = {'designed': 'designer', 'built': 'coder', 'verified': 'qa'}
HISTORY = re.compile(r'\b(was renamed|renamed from|used to be|formerly|no longer|previously|replaced by|superseded by)\b', re.I)
DECISION_ID = re.compile(r'\((?:[A-Z]{1,4}\d{1,3})(?:\s*[,·]\s*[A-Z]{1,4}\d{1,3})*\)')

errors, warnings = [], []


def err(path, msg):
    errors.append(f'{path.relative_to(ROOT)}: {msg}')


def front_matter(path, text):
    m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
    if not m:
        err(path, 'no front-matter')
        return {}, text
    fm = {}
    for line in m.group(1).splitlines():
        if ':' not in line:
            continue
        k, v = line.split(':', 1)
        v = v.split('#', 1)[0].strip()
        fm[k.strip()] = [x.strip() for x in v[1:-1].split(',') if x.strip()] if v.startswith('[') else v
    return fm, text[m.end():]


def sections(body):
    return set(re.findall(r'^## (.+?)\s*$', body, re.M))


def section(body, name):
    return body.split(f'## {name}', 1)[1].split('\n## ', 1)[0] if f'## {name}' in body else ''


def table_rows(text):
    """The data rows of the markdown tables in ``text``, each a list of stripped cells."""
    rows = []
    for line in text.splitlines():
        if not line.startswith('|') or re.match(r'^\|[-| :]+\|\s*$', line):
            continue
        rows.append([c.strip() for c in line.strip().strip('|').split('|')])
    return rows


def kind_of(path):
    rel = path.relative_to(SPECS).parts
    if rel[0] == 'journeys':
        return 'journey'
    if rel[0] not in AREAS:
        return None
    if len(rel) == 3 and rel[2] == 'product.md':
        return 'product'
    if len(rel) == 5 and rel[2] == 'features' and rel[4] == 'feature.md':
        return 'feature'
    if len(rel) == 7 and rel[2] == 'features' and rel[4] == 'stories' and rel[6] == 'story.md':
        return 'story'
    if len(rel) == 7 and rel[2] == 'features' and rel[4] == 'stories' and rel[6] == 'task.md':
        return 'task'
    if rel[2:3] == ('features',):
        err(path, 'not a place a spec file lives — a feature is `features/<ID>-<slug>/feature.md`, a story '
                  '`features/<ID>-<slug>/stories/<ID>-<slug>/story.md` beside its `task.md`')
    return None


def glossary_banned():
    g = SPECS / 'glossary.md'
    if not g.exists():
        return []
    m = re.search(r'\| Not on screen \|.*?\n\|[-| ]+\|\n(.*?)(?:\n\n|\Z)', g.read_text(), re.S)
    if not m:
        return []
    words = []
    for row in m.group(1).splitlines():
        cell = row.strip('|').split('|')[0]
        words += [w.strip(' *`') for w in re.split(r'[·,]', cell) if w.strip(' *`')]
    return [w for w in words if len(w) > 2]


def check_story(path, fm, body, boards_cited):
    """The five parts of one story; returns its criterion IDs."""
    sid = fm.get('id', '')
    if not re.fullmatch(r'[A-Z]{2}-\d{2,3}', sid):
        err(path, f'story id `{sid}` is not <CODE>-<nn>')
        return []
    if not path.parent.name.startswith(sid + '-'):
        err(path, f'folder name must start with its id `{sid}-`')
    if not re.search(rf'^# {re.escape(sid)} · .+$', body, re.M):
        err(path, f'needs the heading `# {sid} · {fm.get("title", "Title")}`')
    if not re.search(r'\*\*As\*\*.+\*\*I want\*\*.+\*\*so that\*\*', body, re.S):
        err(path, 'needs **As** … **I want** … **so that** …')
    crit = re.findall(rf'^\| ({re.escape(sid)}\.\d+) \|', section(body, 'Acceptance criteria'), re.M)
    if not crit:
        err(path, f'no acceptance criteria (`| {sid}.1 | Given | When | Then |`)')
    if len(set(crit)) != len(crit):
        err(path, 'a criterion id repeats')
    who = section(body, 'Who can')
    for lens in ('Admin', 'Operator'):
        if not re.search(rf'^\| {lens} \|', who, re.M):
            err(path, f'Who can needs an `{lens}` row')
    if '```mermaid' not in section(body, 'Flow'):
        err(path, 'Flow needs a mermaid diagram')
    rows = [r for r in table_rows(section(body, 'Screens')) if r[0] != 'Surface']
    lenses = {}
    for cells in rows:
        if len(cells) != 9:
            err(path, f'Screens row needs 9 cells (surface, lens, 7 states): {" | ".join(cells)[:60]}')
            continue
        if any(not c for c in cells):
            err(path, f'Screens has an empty cell for `{cells[0]} · {cells[1]}` — name the board, or `—`')
        if cells[1] not in ('Admin', 'Operator'):
            err(path, f'Screens lens `{cells[1]}` is not Admin or Operator')
        lenses.setdefault(cells[0], set()).add(cells[1])
        boards_cited.update(c.split(' · ')[0].strip('` ') for c in cells[2:] if c not in ('—', '-', ''))
    for surf, ls in lenses.items():
        if ls != {'Admin', 'Operator'}:
            err(path, f'Screens `{surf}` needs a row for both Admin and Operator')
    if '## Screens' in body and not rows:
        err(path, 'Screens has no rows')
    return crit


def check_tasks(path, sid, criteria, status):
    """The task table of one story, and that the story's status does not run ahead of it."""
    text = path.read_text()
    rows = table_rows(text)
    if not rows or rows[0] != TASK_COLUMNS:
        err(path, f'needs one table with the columns {" · ".join(TASK_COLUMNS)}')
        return {}
    tasks, owners = {}, {o: [] for o in OWNERS}
    order = []
    for cells in rows[1:]:
        if len(cells) != len(TASK_COLUMNS):
            err(path, f'task row needs {len(TASK_COLUMNS)} cells: {" | ".join(cells)[:60]}')
            continue
        t = dict(zip(TASK_COLUMNS, cells))
        tid = t['ID']
        if not re.fullmatch(rf'{re.escape(sid)}-T\d+', tid):
            err(path, f'task id `{tid}` is not `{sid}-T<n>`')
        if tid in tasks:
            err(path, f'task id `{tid}` repeats')
        if t['Owner'] not in OWNERS:
            err(path, f'{tid}: owner `{t["Owner"]}` is not one of {", ".join(OWNERS)}')
        else:
            owners[t['Owner']].append(t)
            order.append(OWNERS.index(t['Owner']))
        if t['Status'] not in TASK_STATUSES:
            err(path, f'{tid}: status `{t["Status"]}` is not one of {", ".join(TASK_STATUSES)}')
        for c in ('Title', 'Description', 'Story', 'Evidence'):
            if not t[c]:
                err(path, f'{tid}: `{c}` is empty')
        if sid not in t['Story']:
            err(path, f'{tid}: Story must name `{sid}`')
        for ref in re.findall(r'[A-Z]{2}-\d{2,3}\.\d+', t['Criteria']):
            if ref not in criteria:
                err(path, f'{tid}: criterion `{ref}` is not in the story')
        if t['Status'] == 'done' and t['Evidence'] in ('—', '-'):
            err(path, f'{tid}: a done task names its evidence')
        tasks[tid] = t
    for tid, t in tasks.items():
        for dep in re.findall(r'[A-Z]{2}-\d{2,3}-T\d+', t['Depends on']):
            if dep not in tasks:
                err(path, f'{tid}: depends on `{dep}`, which is not a task of this story')
    if order != sorted(order):
        err(path, 'rows are sorted by owner: designer · coder · qa')
    reached = STATUSES.index(status) if status in STATUSES else 0
    for gate, owner in GATE_OWNER.items():
        if reached < STATUSES.index(gate):
            continue
        live = [t for t in owners[owner] if t['Status'] != 'dropped']
        if not live:
            err(path, f'the story is `{status}` but has no {owner} task')
        open_ = [t['ID'] for t in live if t['Status'] != 'done']
        if open_:
            err(path, f'the story is `{status}` but {owner} tasks are open: {", ".join(open_)}')
    for gate, owner in (('built', 'coder'), ('verified', 'qa')):
        if reached >= STATUSES.index(gate):
            covered = set(re.findall(r'[A-Z]{2}-\d{2,3}\.\d+', ' '.join(t['Criteria'] for t in owners[owner])))
            missing = [c for c in criteria if c not in covered]
            if missing:
                err(path, f'the story is `{status}` but no {owner} task covers {", ".join(missing)}')
    return tasks


def main(write_index=False):
    docs = {}
    for path in sorted(SPECS.rglob('*.md')):
        kind = kind_of(path)
        if kind in (None, 'task'):
            continue
        fm, body = front_matter(path, path.read_text())
        docs[path] = (kind, fm, body)

    ids, stories, tasks_of, boards_cited = {}, {}, {}, set()
    banned = glossary_banned()
    for path, (kind, fm, body) in docs.items():
        for k in KEYS[kind]:
            if k not in fm:
                err(path, f'front-matter is missing `{k}`')
        if 'status' in fm and fm['status'] not in STATUSES:
            err(path, f'status `{fm["status"]}` is not one of {", ".join(STATUSES)}')
        for s in SECTIONS[kind]:
            if s not in sections(body):
                err(path, f'missing section `## {s}`')
        fid = fm.get('id', '')
        if fid in ids:
            err(path, f'id `{fid}` is also used by {ids[fid].relative_to(ROOT)}')
        ids[fid] = path
        if kind == 'feature':
            if not re.fullmatch(r'[A-Z]{2}-F\d{2}', fid):
                err(path, f'feature id `{fid}` is not <CODE>-F<nn>')
            elif not path.parent.name.startswith(fid + '-'):
                err(path, f'folder name must start with its id `{fid}-`')
            if fm.get('product') and not fid.startswith(fm['product'] + '-'):
                err(path, f'id `{fid}` does not belong to product `{fm["product"]}`')
        if kind == 'story':
            stories[fid] = path
            crit = check_story(path, fm, body, boards_cited)
            task_path = path.parent / 'task.md'
            if not task_path.exists():
                err(path, 'no `task.md` beside it — copy templates/task.md')
            elif re.fullmatch(r'[A-Z]{2}-\d{2,3}', fid):
                tasks_of[fid] = check_tasks(task_path, fid, crit, fm.get('status', 'idea'))
            feature = path.parents[2] / 'feature.md'
            if not feature.exists():
                err(path, 'no `feature.md` in the feature folder above it')
            elif fm.get('feature') and not path.parents[2].name.startswith(fm['feature'] + '-'):
                err(path, f'`feature: {fm["feature"]}` is not the folder it sits in')
            if fid and fm.get('feature') and not fid.startswith(fm['feature'].split('-')[0] + '-'):
                err(path, f'story `{fid}` does not belong to product `{fm["feature"].split("-")[0]}`')
        if kind == 'journey':
            if not re.fullmatch(r'J\d{2}', fid):
                err(path, f'journey id `{fid}` is not J<nn>')
            if '```mermaid' not in section(body, 'The journey'):
                err(path, 'The journey needs a mermaid diagram')
        boards_cited |= set(fm.get('boards', []))
        for i, line in enumerate(body.splitlines(), 1):
            if HISTORY.search(line):
                err(path, f'line {i}: history in a spec — say what is true now')
            if DECISION_ID.search(line):
                err(path, f'line {i}: a decision id in prose')
        crit_text = '\n'.join(re.findall(r'^\| [A-Z]{2}-\d{2,3}\.\d+ \|.*$', body, re.M))
        for w in banned:
            if re.search(rf'\b{re.escape(w)}\b', crit_text, re.I):
                err(path, f'criterion uses `{w}`, a word never shown on screen (glossary.md)')

    for path, (kind, fm, body) in docs.items():
        if kind != 'feature':
            continue
        here = {s: p for s, p in stories.items() if p.parents[2] == path.parent}
        declared = set(fm.get('stories', []))
        if not here:
            err(path, 'no user stories (`stories/<CODE>-<nn>-<slug>/story.md`)')
        if declared != set(here):
            err(path, f'front-matter `stories` {sorted(declared)} ≠ story folders {sorted(here)}')
        listed = {r[0] for r in table_rows(section(body, 'Stories')) if re.fullmatch(r'[A-Z]{2}-\d{2,3}', r[0])}
        if listed != set(here):
            err(path, f'the Stories table {sorted(listed)} ≠ story folders {sorted(here)}')
        diagrams = re.findall(r'```mermaid\n(.*?)```', section(body, 'User journey'), re.S)
        if not any(d.lstrip().startswith(('flowchart', 'graph')) for d in diagrams):
            err(path, 'User journey needs a mermaid flowchart')
        else:
            on_map = '\n'.join(diagrams)
            for sid in here:
                if sid not in on_map:
                    err(path, f'{sid} is not on the User journey diagram — label its step with the id')
        levels = [docs[p][1].get('status') for p in here.values()]
        levels = [STATUSES.index(s) for s in levels if s in STATUSES]
        if levels and fm.get('status') in STATUSES and STATUSES.index(fm['status']) != min(levels):
            err(path, f'status `{fm["status"]}` is not the lowest of its stories (`{STATUSES[min(levels)]}`)')

    known = set(ids)
    for path, (kind, fm, body) in docs.items():
        for k in ('stories', 'depends_on'):
            for ref in fm.get(k, []):
                if ref not in known:
                    err(path, f'`{k}` names `{ref}`, which no spec defines')
        if kind == 'story' and fm.get('feature') and fm['feature'] not in known:
            err(path, f'`feature` names `{fm["feature"]}`, which no spec defines')
        for j in fm.get('journeys', []):
            if j not in ids:
                err(path, f'`journeys` names `{j}`, which no journey defines')
        for target in re.findall(r'\]\(([^)#:]+\.md)', body):
            if not (path.parent / target).resolve().exists():
                err(path, f'link to `{target}` does not resolve')

    if CANVAS.exists():
        drawn = {p.name[:-8] for p in CANVAS.glob('*.dc.html')}
        for b in sorted(boards_cited - drawn):
            errors.append(f'board `{b}` is cited by a spec but is not on the canvas')
    elif boards_cited:
        warnings.append('board check skipped — the Agent version canvas is not built locally')

    if write_index and not errors:
        index(docs, tasks_of)
    for w in warnings:
        print('warn:', w)
    for e in errors:
        print('error:', e)
    n_tasks = sum(len(t) for t in tasks_of.values())
    print(f'{len(docs)} specs · {len(stories)} stories · {n_tasks} tasks · {len(errors)} errors')
    return 1 if errors else 0


def open_tasks(tasks):
    """Open tasks per owner, as `designer 1 · coder 3`, or `—`."""
    counts = [f'{o} {n}' for o in OWNERS
              if (n := sum(1 for t in tasks.values() if t['Owner'] == o and t['Status'] not in ('done', 'dropped')))]
    return ' · '.join(counts) or '—'


def index(docs, tasks_of):
    rows = []
    products = sorted(((fm, p) for p, (k, fm, _) in docs.items() if k == 'product'),
                      key=lambda x: (list(AREAS).index(x[1].relative_to(SPECS).parts[0]), x[0]['id']))
    area = None
    for fm, p in products:
        if p.relative_to(SPECS).parts[0] != area:
            area = p.relative_to(SPECS).parts[0]
            rows.append(f'\n## {AREAS[area]}\n')
        rows.append(f'\n### {fm["title"]} · `{fm["id"]}` · {fm["status"]}\n')
        rows.append('| Feature | Story | Title | Status | Open tasks |\n|---|---|---|---|---|')
        feats = sorted(((f, q) for q, (k, f, _) in docs.items() if k == 'feature' and f.get('product') == fm['id']),
                       key=lambda x: x[0]['id'])
        for f, q in feats:
            rows.append(f'| **{f["id"]}** | | [{f["title"]}]({q.relative_to(SPECS)}) | {f["status"]} | |')
            here = sorted(((s, sp) for sp, (k, s, _) in docs.items() if k == 'story' and sp.parents[2] == q.parent),
                          key=lambda x: x[0]['id'])
            for s, sp in here:
                rows.append(f'| | {s["id"]} | [{s["title"]}]({sp.relative_to(SPECS)}) | {s["status"]} | '
                            f'[{open_tasks(tasks_of.get(s["id"], {}))}]({(sp.parent / "task.md").relative_to(SPECS)}) |')
    journeys = sorted(((f, q) for q, (k, f, _) in docs.items() if k == 'journey'), key=lambda x: x[0]['id'])
    if journeys:
        rows.append('\n## Journeys\n\n| ID | Journey | Stories |\n|---|---|---|')
        rows += [f'| {f["id"]} | [{f["title"]}]({q.relative_to(SPECS)}) | {" · ".join(f.get("stories", []))} |' for f, q in journeys]
    (SPECS / 'README.md').write_text(
        '# Invana product specs\n\nWhat Invana does and why — products, the foundation every product uses, features, '
        'user stories and the tasks that '
        'deliver them, journeys. Every spec follows one format and passes `python3 scripts/specs/check.py`. '
        'This index is generated by `python3 scripts/specs/check.py --index` — do not edit it by hand.\n'
        + ('\n'.join(rows) if rows else '\nNo specs yet.') + '\n')


if __name__ == '__main__':
    sys.exit(main('--index' in sys.argv))
