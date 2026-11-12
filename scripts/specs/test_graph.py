"""Tests for graph.py: the typed graph, its analysis, ``--placeholders`` and the ``placeholder`` status.

    python3 -m unittest discover -s scripts/specs

Each test builds a small spec tree in a temporary folder and points the parser at it. Standard library only.
"""
import io
import json
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check
import graph
from test_check import Tree

TASKS = '| ' + ' | '.join(check.TASK_COLUMNS) + ' |\n|' + '---|' * len(check.TASK_COLUMNS) + '\n'


class SpecTree(Tree):
    """A tree with two products, features that depend on each other, a story with tasks and a journey."""

    def setUp(self):
        super().setUp()
        p = mock.patch.object(check, 'CANVAS', self.root / '.design' / 'canvas' / 'project')
        p.start()
        self.addCleanup(p.stop)
        self.write('specs/personas.md', '## The people\n\n| Key | Persona |\n|---|---|\n'
                                        '| `modeller` | **Modeller** — a modeller |\n| `owner` | **Graph owner** |\n')
        self.product('capabilities/model', 'MO', 'Model', depends='| Graph › This graph | the connection |')
        self.product('os/graph', 'GR', 'Graph')

    def product(self, area, pid, title, depends=''):
        self.write(f'specs/{area}/product.md',
                   f'---\nid: {pid}\ntitle: {title}\nstatus: idea\nowner: pm\npersonas: [owner]\n---\n# {title}\n\n'
                   f'## Decisions\n\n| Decision | Detail |\n|---|---|\n| One per Graph | x |\n\n'
                   f'## Depends on\n\n| Product or capability | For |\n|---|---|\n{depends}\n')

    def feature(self, fid, status='idea', depends='', journeys='', extra='', nfrs=None):
        area = 'capabilities/model' if fid.startswith('MO') else 'os/graph'
        folder = f'specs/{area}/features/{fid}-x'
        keys = f'nfrs: [{nfrs}]\n' if nfrs is not None else ''
        self.write(f'{folder}/feature.md',
                   f'---\nid: {fid}\ntitle: {fid} title\nproduct: {fid[:2]}\nstatus: {status}\npersonas: [modeller]\n'
                   f'stories: []\njourneys: [{journeys}]\nboards: [model.new]\n{keys}depends_on: [{depends}]\n---\n'
                   f'# {fid}\n\n## Rules\n\nLeans on GR-F01.\n\n{extra}'
                   f'## Decisions\n\n| Decision | Detail |\n|---|---|\n| A draft first | see MO-04 |\n\n'
                   '## Not building\n\n| Item | Why not |\n|---|---|\n')
        return folder

    def story(self, folder, sid, fid, tasks=''):
        self.write(f'{folder}/stories/{sid}-x/story.md',
                   f'---\nid: {sid}\ntitle: {sid}\nfeature: {fid}\nstatus: idea\npersonas: [modeller]\n'
                   f'boards: [model.board]\n---\n# {sid} · x\n')
        self.write(f'{folder}/stories/{sid}-x/task.md', TASKS + tasks)

    def graph(self):
        return graph.to_json(graph.build())


class Extraction(SpecTree):
    def test_nodes_and_edges_are_typed_and_read_from_the_files(self):
        folder = self.feature('MO-F01', journeys='J01', depends='GR-F01')
        self.feature('GR-F01')
        self.story(folder, 'MO-04', 'MO-F01',
                   '| MO-04-T1 | coder | Engine | x | [MO-04](story.md) | — | — | — | todo | — |\n'
                   '| MO-04-T2 | coder | Studio | x | [MO-04](story.md) | — | `model.board` | MO-04-T1 | todo | — |\n')
        self.write('specs/journeys/J01-x.md', '---\nid: J01\ntitle: First\npersonas: [owner]\nstories: [MO-04]\n'
                                              'boards: []\n---\n# First\n')
        self.write('specs/notes/architecture.md', 'See [MO](../capabilities/model/product.md) and MO-F01.')
        data = self.graph()
        nodes = {n['id']: n for n in data['nodes']}
        edges = {(e['source'], e['target'], e['type']) for e in data['edges']}
        self.assertEqual(nodes['MO-04-T2']['kind'], 'Task')
        self.assertEqual(nodes['MO-F01/D1']['kind'], 'Decision')
        # A markdown file that is no spec kind is not parsed: no node, no edge from it.
        self.assertFalse([n for n in nodes.values() if n['path'] == 'specs/notes/architecture.md'])
        self.assertNotIn('Doc', data['counts']['nodes'])
        self.assertEqual(nodes['MO-04']['path'], 'specs/capabilities/model/features/MO-F01-x/stories/MO-04-x/story.md')
        self.assertEqual(nodes['MO-04']['product'], 'MO')
        for edge in [('MO-04', 'MO-F01', 'PART_OF'), ('MO-F01', 'MO', 'PART_OF'), ('MO-04-T1', 'MO-04', 'PART_OF'),
                     ('MO-F01', 'GR-F01', 'DEPENDS_ON'), ('MO', 'GR', 'DEPENDS_ON'),
                     ('MO-04-T2', 'MO-04-T1', 'DEPENDS_ON'), ('MO-04', 'persona:modeller', 'SERVES'),
                     ('MO-04', 'board:model.board', 'DRAWN_ON'), ('MO-04-T2', 'board:model.board', 'DRAWN_ON'),
                     ('MO-04', 'J01', 'IN_JOURNEY'), ('MO-F01', 'J01', 'IN_JOURNEY'),
                     ('MO-F01/D1', 'MO-F01', 'DECIDES'), ('MO-F01/D1', 'MO-04', 'MENTIONS')]:
            self.assertIn(edge, edges)
        # A typed edge already joins the two: prose never adds a second, untyped one.
        self.assertNotIn(('MO-F01', 'GR-F01', 'MENTIONS'), edges)
        self.assertEqual(data['analysis']['dangling'], [])

    def test_an_undefined_reference_is_dangling_never_an_edge(self):
        self.feature('MO-F01', journeys='J09', depends='MO-F09')
        data = self.graph()
        self.assertEqual({d['ref'] for d in data['analysis']['dangling']}, {'J09', 'MO-F09'})
        self.assertFalse({'J09', 'MO-F09'} & {e['target'] for e in data['edges']})


    def test_a_journey_diagram_gives_steps_and_next_edges_joined_through_shared_stories(self):
        folder = self.feature('MO-F01')
        for sid in ('MO-04', 'MO-05', 'MO-06'):
            self.story(folder, sid, 'MO-F01')
        flow = ('## The journey\n\n```mermaid\nflowchart TD\n  A([Start]) --> B["MO-04 · Draft"]\n'
                '  B --> C{"Accept?"}\n  C -->|reject| B\n  C -->|accept| D["MO-05 · MO-06 · Publish"]\n```\n')
        self.write('specs/journeys/J01-x.md', '---\nid: J01\ntitle: One\npersonas: []\nstories: []\nboards: []\n'
                                              '---\n# One\n\n' + flow)
        self.write('specs/journeys/J02-x.md', '---\nid: J02\ntitle: Two\npersonas: []\nstories: []\nboards: []\n'
                                              '---\n# Two\n\n## The journey\n\n```mermaid\nflowchart LR\n'
                                              '  X["MO-05 · Again"] --> Y["MO-04 · Back"]\n```\n')
        data = self.graph()
        nodes = {n['id']: n for n in data['nodes']}
        nxt = {(e['source'], e['target'], e['journey'], e['label']) for e in data['edges'] if e['type'] == 'NEXT'}
        self.assertEqual({k: nodes['J01:C'][k] for k in ('kind', 'title', 'journey', 'shape')},
                         {'kind': 'Step', 'title': 'Accept?', 'journey': 'J01', 'shape': 'decision'})
        self.assertEqual(nodes['J01:A']['shape'], 'terminal')
        self.assertNotIn('J01:B', nodes)
        self.assertEqual(nxt, {('J01:A', 'MO-04', 'J01', ''), ('MO-04', 'J01:C', 'J01', ''),
                               ('J01:C', 'MO-04', 'J01', 'reject'), ('J01:C', 'MO-05', 'J01', 'accept'),
                               ('J01:C', 'MO-06', 'J01', 'accept'), ('MO-05', 'MO-04', 'J02', '')})
        self.assertNotIn('journey', next(e for e in data['edges'] if e['type'] == 'PART_OF'))


ENGINE = '''## Engine

### Records

| Table | Columns | Notes |
|---|---|---|
| `model_models` | `graph_id` · `name` · `status` (`draft_id` · `live`) · `created_by_kind` · `created_by_id` | One per model |
| `model_versions` · `model_drafts` | `model_id` · `parent_id?` · `run_id` | Shared shape |
| Layer | not a record | x |

### Reads

| Record | Owner |
|---|---|
| The Graph's row — `graphs` | [GR-F01](x) |
| Runs and their steps | [GR-F01](x) |

### Routes

| Route, after `/api/v1/u/{u}/{g}/model` | Does | Story |
|---|---|---|
| `GET /` · `POST /` | List · create | MO-04 |
| `PATCH /{id}` | Edit one | MO-04 |
| `/{id}/draft` | No method | MO-04 |

| Route, install-wide | Does | Story |
|---|---|---|
| `GET /api/v1/model/types?kind=x` | Every type | MO-04 |

### Events

| Event | When |
|---|---|
| `model.models.created` · `updated` · `.archived` | Each act, after `PATCH /{id}` |
| `model.*` | Wildcard |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 403 | `PATCH /{id}` without the right | *This needs Can shape the model.* | MO-04.2 |
| 409 | An edit of a closed model | *Closed.* | API only — Studio hides it |
| 422 | A bad name | *Bad.* | later |
| 404 | A missing model | *Not found.* | MO-04.9 |
'''

CRITERIA = ('## Acceptance criteria\n\n| # | Given | When | Then |\n|---|---|---|---|\n'
            '| MO-04.1 | A draft | it is saved | *it* is listed |\n| MO-04.2 | No right | they edit | it is refused |\n'
            '| 4.3 | A bad id | x | y |\n')


class EngineEntities(SpecTree):
    """Records, routes, events, refusals and criteria read from ``## Engine`` and *Acceptance criteria*."""

    def build_tree(self):
        folder = self.feature('MO-F01', extra=ENGINE)
        self.feature('GR-F01', extra='## Engine\n\n### Records\n\n| Table | Columns | Notes |\n|---|---|---|\n'
                                          '| `graphs` | `name` | x |\n| `agents_runs` | `graph_id` | x |\n'
                                          '| `explore_runs` | `graph_id` | x |\n\n'
                                          '### Events\n\n| Event | When |\n|---|---|\n| `model.models.created` | Again |\n')
        self.story(folder, 'MO-04', 'MO-F01')
        story = self.root / folder / 'stories' / 'MO-04-x' / 'story.md'
        story.write_text(story.read_text() + '\n**As** a modeller **I want** a model\n**so that** it holds.\n\n'
                         + CRITERIA)
        return self.graph()

    def test_engine_rows_become_typed_nodes_and_edges(self):
        data = self.build_tree()
        nodes = {n['id']: n for n in data['nodes']}
        edges = {(e['source'], e['target'], e['type']) for e in data['edges']}
        self.assertEqual({k: nodes['record:model_models'][k] for k in ('kind', 'product', 'description', 'columns')},
                         {'kind': 'Record', 'product': 'MO', 'description': 'One per model',
                          'columns': ['graph_id', 'name', 'status', 'created_by_kind', 'created_by_id']})
        self.assertEqual(nodes['MO-04.1']['title'], 'it is listed')
        self.assertEqual(nodes['MO-04.1']['description'], 'Given A draft — When it is saved — Then *it* is listed')
        self.assertEqual(nodes['MO-F01/R1']['title'], '403 · This needs Can shape the model.')
        for edge in [('MO-F01', 'record:model_models', 'OWNS'), ('MO-F01', 'record:model_drafts', 'OWNS'),
                     ('record:model_models', 'record:graphs', 'REFERENCES'),
                     ('record:model_versions', 'record:model_models', 'REFERENCES'),
                     ('MO-F01', 'record:graphs', 'READS'),
                     ('MO-F01', 'route:GET /api/v1/u/{u}/{g}/model', 'SERVES_ROUTE'),
                     ('MO-F01', 'route:PATCH /api/v1/u/{u}/{g}/model/{id}', 'SERVES_ROUTE'),
                     ('MO-F01', 'route:GET /api/v1/model/types', 'SERVES_ROUTE'),
                     ('route:PATCH /api/v1/u/{u}/{g}/model/{id}', 'event:model.models.updated', 'EMITS'),
                     ('route:PATCH /api/v1/u/{u}/{g}/model/{id}', 'MO-F01/R1', 'REFUSES'),
                     ('MO-F01/R1', 'MO-04.2', 'PROVEN_BY'), ('MO-04.2', 'MO-04', 'PART_OF'),
                     ('event:model.models.archived', 'MO-F01', 'PART_OF'), ('MO-F01/R2', 'MO-F01', 'PART_OF')]:
            self.assertIn(edge, edges)
        # A `_kind` column beside `created_by_id` names a kind, not a record; an enum value in parentheses is no column.
        self.assertNotIn('draft_id', nodes['record:model_models']['columns'])
        self.assertEqual(nodes['MO-04']['description'], '**As** a modeller **I want** a model **so that** it holds.')
        self.assertEqual(nodes['persona:modeller']['description'], None)

    def test_a_row_the_parser_cannot_read_is_dangling_never_dropped_or_guessed(self):
        data = self.build_tree()
        dangling = {(d['source'], d['ref'], d['via']) for d in data['analysis']['dangling']}
        for d in [('MO-F01', 'Layer', 'Engine Records'),
                  ('MO-F01', 'Runs and their steps', 'Engine Reads'),
                  ('MO-F01', '`/{id}/draft`', 'Engine Routes'),
                  ('MO-F01', '`model.*`', 'Engine Events'),
                  ('MO-F01/R3', 'later', 'Engine Refusals Criterion'),
                  ('MO-F01/R4', 'MO-04.9', 'Criterion'),
                  ('MO-04', '4.3', 'Acceptance criteria'),
                  ('record:model_versions', 'parent_id', 'Records _id: no record'),
                  ('record:model_versions', 'run_id', 'Records _id: several records'),
                  ('GR-F01', 'event:model.models.created', 'Engine Events: owned twice')]:
            self.assertIn(d, dangling)
        self.assertFalse(any(d[1] == 'created_by_id' for d in dangling))
        # Never guessed: no edge to a record the column does not name exactly once, and the API-only refusal is fine.
        self.assertFalse([e for e in data['edges'] if e['type'] == 'REFERENCES' and e['via'] == 'run_id'])
        self.assertFalse(any(d[0] == 'MO-F01/R2' for d in dangling))
        self.assertTrue(next(n for n in data['nodes'] if n['id'] == 'event:model.models.created')['path']
                        .startswith('specs/capabilities/model/'))


class Analysis(SpecTree):
    def test_cycles_chains_blockers_orphans_and_gaps(self):
        self.feature('MO-F01', status='specified', depends='MO-F02')
        self.feature('MO-F02', depends='MO-F03')
        self.feature('MO-F03', extra='## Engine\n\nRecords.\n\n## System impact\n\n> Placeholder — x\n\n', nfrs='')
        self.feature('GR-F01', depends='GR-F02')
        self.feature('GR-F02', depends='GR-F01')
        self.write('specs/journeys/J09-x.md', '---\nid: J09\ntitle: Lonely\npersonas: []\nstories: []\nboards: []\n'
                                              '---\n# Lonely\n\nNothing links here.\n')
        a = self.graph()['analysis']
        self.assertEqual(a['cycles'], [['GR-F01', 'GR-F02']])
        self.assertEqual(a['chains'], [['MO-F01', 'MO-F02', 'MO-F03']])
        self.assertEqual(a['blockers'], [{'source': 'MO-F01', 'target': 'MO-F02', 'type': 'DEPENDS_ON'}])
        self.assertEqual(a['orphans'], ['J09'])
        gaps = {(g['node'], g['gap']) for g in a['gaps']}
        self.assertIn(('MO-F01', 'no-engine'), gaps)
        self.assertIn(('MO-F01', 'no-nfrs'), gaps)
        self.assertIn(('MO-F03', 'placeholder-system-impact'), gaps)
        self.assertNotIn(('MO-F03', 'no-engine'), gaps)
        self.assertNotIn(('MO-F03', 'no-nfrs'), gaps)


class DesignEdges(SpecTree):
    def test_must_meet_and_changes_and_the_blockers_through_them(self):
        self.write('specs/system-design.md',
                   '# System design\n\n## 1. Context\n\n> Placeholder — x.\n\n## 3. Non-functional requirements\n\n'
                   '| ID | Quality | Target | Measured by | Enforced by | Constrains |\n|---|---|---|---|---|---|\n'
                   '| NFR-PERF-1 | Speed | 2 s | p95 | test | GR-F01 |\n'
                   '| NFR-SEC-00 | Security | Placeholder — not set | — | — | — |\n')
        self.feature('MO-F01', status='specified', nfrs='NFR-PERF-1',
                     extra='## System impact\n\nChanges § 1; touches NFR-SEC-00.\n\n')
        self.feature('GR-F01')
        data = self.graph()
        edges = {(e['source'], e['target'], e['type']): e['via'] for e in data['edges']}
        self.assertEqual(edges[('MO-F01', 'NFR-PERF-1', 'MUST_MEET')], 'nfrs')
        self.assertEqual(edges[('GR-F01', 'NFR-PERF-1', 'MUST_MEET')], 'NFR Constrains')
        self.assertEqual(edges[('MO-F01', 'NFR-SEC-00', 'MUST_MEET')], 'System impact')
        self.assertEqual(edges[('MO-F01', 'system-design#1', 'CHANGES')], 'System impact')
        self.assertEqual(data['analysis']['blockers'], [
            {'source': 'MO-F01', 'target': 'NFR-SEC-00', 'type': 'MUST_MEET'},
            {'source': 'MO-F01', 'target': 'system-design#1', 'type': 'CHANGES'}])

    def test_a_placeholder_system_impact_adds_no_edge(self):
        self.write('specs/system-design.md', '# System design\n\n## 1. Context\n\nReal.\n')
        self.feature('MO-F01', extra='## System impact\n\n> Placeholder — § 1 later.\n\n')
        self.assertNotIn('CHANGES', {e['type'] for e in self.graph()['edges']})


class Cli(SpecTree):
    def cli(self, *argv):
        with mock.patch('builtins.print'), mock.patch('sys.stderr', io.StringIO()):
            return check.cli(list(argv))

    def test_graph_out_writes_the_same_bytes_every_time(self):
        self.feature('MO-F01', depends='GR-F01', extra=ENGINE)
        self.feature('GR-F01')
        first, second = self.root / 'a' / 'g.json', self.root / 'b.json'
        self.assertEqual(self.cli('--graph', '--out', str(first)), 0)
        self.assertEqual(self.cli('--graph', '--out', str(second)), 0)
        self.assertEqual(first.read_bytes(), second.read_bytes())
        self.assertEqual(json.loads(first.read_text())['version'], 1)
        self.assertFalse((self.root / 'specs-graph.json').exists())

    def test_bad_flag_combinations_are_refused(self):
        for argv in (['--graph', '--out'], ['--graph', '--placeholders'], ['--out', 'x.json'], ['--write'],
                     ['--graph', '--write']):
            with self.subTest(argv=argv), self.assertRaises(SystemExit) as stop:
                self.cli(*argv)
            self.assertEqual(stop.exception.code, 2)
        self.assertFalse((self.root / 'specs-graph.json').exists())

    def test_written_placeholders_pass_the_check(self):
        self.feature('MO-F01', journeys='J02')
        self.assertEqual(self.cli('--placeholders', '--write'), 0)
        written = ['specs/system-design.md', 'specs/journeys/J02-placeholder.md']
        self.assertTrue(all((self.root / w).exists() for w in written))
        with mock.patch.object(check, 'check_surfaces'):
            self.cli()  # the fixture's products and feature are not complete specs; only the written files count
        self.assertEqual([e for e in check.errors if any(e.startswith(w) for w in written)], [])
        self.assertFalse(any('J02' in e for e in check.errors), check.errors)


class Placeholders(SpecTree):
    def run_placeholders(self, write):
        with mock.patch('builtins.print'):
            graph.placeholders(write=write)

    def test_dry_run_writes_nothing_and_write_is_idempotent(self):
        folder = self.feature('MO-F01', journeys='J02', extra='## Engine\n\nRecords: the model.\n\n')
        before = (self.root / folder / 'feature.md').read_text()
        self.run_placeholders(write=False)
        self.assertFalse((self.specs / 'system-design.md').exists())
        self.assertEqual((self.root / folder / 'feature.md').read_text(), before)

        self.run_placeholders(write=True)
        sd = (self.specs / 'system-design.md').read_text()
        self.assertIn('status: placeholder', sd)
        self.assertEqual(sd.count('\n## '), 15)
        self.assertEqual(sd.count('| Placeholder — not set |'), 7)
        self.assertIn('| NFR-REL-00 | Reliability |', sd)
        feature = (self.root / folder / 'feature.md').read_text()
        self.assertIn('## Engine\n\nRecords: the model.', feature)  # real content kept
        self.assertEqual(feature.count('## Engine'), 1)
        self.assertLess(feature.index('## System impact\n\n> Placeholder —'), feature.index('## Decisions'))
        self.assertTrue((self.specs / 'journeys' / 'J02-placeholder.md').exists())

        snapshot = {p: p.read_text() for p in self.specs.rglob('*.md')}
        self.assertEqual([a for a in graph.plan_placeholders() if a[0] != 'list'], [])
        self.run_placeholders(write=True)
        self.assertEqual({p: p.read_text() for p in self.specs.rglob('*.md')}, snapshot)

        data = self.graph()
        nodes = {n['id']: n for n in data['nodes']}
        self.assertTrue(nodes['NFR-SEC-00']['placeholder'])
        self.assertTrue(nodes['system-design#3']['placeholder'])
        self.assertTrue(nodes['J02']['placeholder'])
        self.assertIn(('NFR-SEC-00', 'system-design#3', 'PART_OF'),
                      {(e['source'], e['target'], e['type']) for e in data['edges']})
        self.assertIn({'node': 'MO-F01', 'gap': 'placeholder-system-impact'}, data['analysis']['gaps'])

    def test_a_partial_system_design_gains_only_what_it_lacks(self):
        self.write('specs/system-design.md', '# System design\n\n## 3. Non-functional requirements\n\n'
                                             '| ID | Quality | Target | Measured by | Enforced by | Constrains |\n'
                                             '|---|---|---|---|---|---|\n| NFR-PERF-1 | Speed | 2 s | p95 | test | MO-F01 |\n')
        self.run_placeholders(write=True)
        sd = (self.specs / 'system-design.md').read_text()
        self.assertIn('| NFR-PERF-1 | Speed | 2 s |', sd)
        self.assertNotIn('NFR-PERF-00', sd)
        self.assertIn('NFR-REL-00', sd)
        self.assertLess(sd.index('## 1. '), sd.index('## 3. '))
        self.assertLess(sd.index('NFR-UX-00'), sd.index('## 4. '))
        self.assertEqual(sd.count('## 3. '), 1)


class PlaceholderStatus(Tree):
    def run_main(self):
        with mock.patch.object(check, 'check_surfaces'), mock.patch('builtins.print'):
            return check.main()

    def test_placeholder_is_accepted_and_an_unknown_status_is_not(self):
        self.write('specs/journeys/J02-placeholder.md',
                   '---\nid: J02\ntitle: Placeholder\nstatus: placeholder\npersonas: []\nstories: []\nboards: []\n'
                   '---\n# J02 · Placeholder\n\n> Placeholder — x\n')
        self.assertEqual(self.run_main(), 0, check.errors)
        self.write('specs/journeys/J03-x.md',
                   '---\nid: J03\ntitle: X\nstatus: bogus\npersonas: []\nstories: []\nboards: []\n---\n# X\n')
        check.errors.clear()
        self.assertEqual(self.run_main(), 1)
        self.assertTrue(any('status `bogus`' in e for e in check.errors), check.errors)


if __name__ == '__main__':
    unittest.main()
