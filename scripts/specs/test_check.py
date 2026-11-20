"""Tests for check.py: the operating-system and capability areas, and the ``specs/_stale/`` rules.

    python3 -m unittest discover -s scripts/specs

Each test builds a small spec tree in a temporary folder and points the checker at it. Standard library only.
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check
import links

FM = {
    'product': 'id: {id}\ntitle: {title}\nstatus: idea\nowner: pm\npersonas: []',
    'feature': 'id: {id}\ntitle: {title}\nproduct: {product}\nstatus: idea\npersonas: []\nstories: []',
    'story': 'id: {id}\ntitle: {title}\nfeature: {feature}\nstatus: idea\npersonas: []\nboards: []',
}


class Tree(unittest.TestCase):
    """A temporary repo root with ``specs/`` and ``docs/``, the checker pointed at it."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.specs = self.root / 'specs'
        patches = [mock.patch.object(check, 'ROOT', self.root), mock.patch.object(check, 'SPECS', self.specs),
                   mock.patch.object(check, 'MILESTONES', self.specs / 'milestones.md'),
                   mock.patch.object(check, 'CANVAS', self.root / '.design' / 'canvas-invana' / 'project'),
                   mock.patch.object(check, 'FLOWS_JSON', self.root / '.design' / 'flows.json')]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        for found in (check.errors, check.warnings):
            found.clear()
            self.addCleanup(found.clear)
        self.addCleanup(self.tmp.cleanup)

    def write(self, rel, text=''):
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        return path

    def spec(self, rel, kind, **fm):
        return self.write(rel, f'---\n{FM[kind].format(**fm)}\n---\n# {fm["title"]}\n')


class Areas(Tree):
    def test_os_and_capabilities_are_spec_areas(self):
        f = 'specs/os/graph/features/GR-F01-open-a-graph'
        cases = {
            'specs/os/graph/product.md': 'product',
            f'{f}/feature.md': 'feature',
            f'{f}/stories/GR-01-open-a-graph/story.md': 'story',
            f'{f}/stories/GR-01-open-a-graph/task.md': 'task',
            'specs/capabilities/model/product.md': 'product',
        }
        for rel, kind in cases.items():
            self.assertEqual(check.kind_of(self.write(rel)), kind, rel)
        self.assertEqual(check.errors, [])

    def test_the_retired_areas_are_not_spec_areas(self):
        for area in ('products', 'foundation'):
            self.assertIsNone(check.kind_of(self.write(Path('specs', area, 'model', 'product.md'))), area)

    def test_stale_is_never_a_spec(self):
        path = self.write('specs/_stale/specs/old/model/product.md')
        self.assertTrue(check.is_stale(path))
        self.assertIsNone(check.kind_of(path))
        self.assertFalse(check.is_stale(self.write('specs/os/graph/product.md')))

    def test_index_lists_the_os_before_the_capabilities(self):
        docs = {}
        for rel, kind, fm in [
            ('specs/capabilities/model/product.md', 'product', {'id': 'MO', 'title': 'Model'}),
            ('specs/os/graph/product.md', 'product', {'id': 'GR', 'title': 'Graph'}),
        ]:
            path = self.spec(rel, kind, **fm)
            docs[path] = (kind, check.front_matter(path, path.read_text())[0], '')
        check.index(docs, {})
        text = (self.specs / 'README.md').read_text()
        self.assertLess(text.index('## Operating system'), text.index('## Capabilities'))
        self.assertLess(text.index('### Graph'), text.index('### Model'))


class StaleLinks(Tree):
    def test_live_links_and_named_paths_pass(self):
        self.write('specs/_stale/README.md', '[live](../vision.md)')
        self.write('specs/vision.md', 'See [glossary](glossary.md). Never cite `specs/_stale/`.\n'
                                      '```\n[x](_stale/README.md)\n```\n')
        self.write('docs/index.md', '[spec](../specs/vision.md) · [web](https://example.com/specs/_stale/a.md)')
        check.check_stale_links()
        self.assertEqual(check.errors, [])

    def test_a_link_into_stale_from_a_spec_or_a_doc_fails(self):
        self.write('specs/_stale/docs/products/old.md', '# old')
        self.write('specs/journeys/notes.md', '[old](../_stale/docs/products/old.md#top)')
        self.write('docs/products/index.md', '[gone](../../specs/_stale/missing.md)')
        self.write('docs/angle.md', '[old](<../specs/_stale/docs/products/old.md> "title")')
        check.check_stale_links()
        self.assertEqual(sorted(e.split(':')[0] for e in check.errors),
                         ['docs/angle.md', 'docs/products/index.md', 'specs/journeys/notes.md'],
                         check.errors)
        self.assertTrue(all('links into `specs/_stale/`' in e for e in check.errors))

    def test_a_reference_style_link_into_stale_fails(self):
        self.write('specs/_stale/old.md', '# old')
        self.write('specs/vision.md', 'See [the old one][old].\n\n[old]: _stale/old.md\n')
        self.write('docs/a.md', '[old]: <../specs/_stale/old.md> "t"\n[web]: https://example.com/_stale/x.md\n')
        check.check_stale_links()
        self.assertEqual(sorted(e.split(':')[0] for e in check.errors), ['docs/a.md', 'specs/vision.md'], check.errors)


    def test_padded_and_spaced_angle_links_into_stale_fail(self):
        self.write('specs/a.md', '[x]( _stale/x.md ) and [y](<_stale/a b.md>) and [z](  <_stale/c.md>) '
                                 'and [w](<_stale/x y.md#h>)')
        check.check_stale_links()
        self.assertEqual(len(check.errors), 4, check.errors)


class LinksSkipStale(Tree):
    def test_links_py_skips_stale_files(self):
        self.write('specs/_stale/a.md', '[dead](nope.md)')
        self.write('specs/b.md', '[ok](b.md)')
        with mock.patch.object(sys, 'argv', ['links.py', str(self.specs)]), mock.patch('builtins.print'):
            self.assertEqual(links.main(), 0)


class WholeCheck(Tree):
    def run_main(self):
        with mock.patch.object(check, 'check_surfaces'), mock.patch('builtins.print'):
            return check.main()

    def test_stale_files_are_skipped_and_a_live_link_fails_the_run(self):
        self.write('specs/_stale/products/bad/product.md', 'not a spec, no front-matter')
        self.assertEqual(self.run_main(), 0)
        self.write('specs/vision.md', '[old](_stale/products/bad/product.md)')
        check.errors.clear()
        self.assertEqual(self.run_main(), 1)
        self.assertEqual(len(check.errors), 1, check.errors)

    def test_a_valid_os_and_capabilities_tree_passes_and_indexes_os_first(self):
        product = ('---\nid: {id}\ntitle: {title}\nstatus: idea\nowner: pm\npersonas: []\n---\n# {title}\n\n'
                   + ''.join(f'## {s}\n\nx\n\n' for s in check.SECTIONS['product']))
        self.write('specs/capabilities/model/product.md', product.format(id='MO', title='Model'))
        self.write('specs/os/graph/product.md', product.format(id='GR', title='Graph'))
        feature = 'specs/os/graph/features/GR-F01-open-a-graph'
        body = {s: 'x' for s in check.SECTIONS['feature']}
        body['Stories'] = '| ID | Story |\n|---|---|\n| GR-01 | Open a graph |'
        body['User journey'] = '```mermaid\nflowchart LR\n  a[GR-01 open] --> b[done]\n```'
        self.write(f'{feature}/feature.md',
                   '---\nid: GR-F01\ntitle: Open a graph\nproduct: GR\nstatus: idea\npersonas: []\nstories: [GR-01]\n'
                   'journeys: []\nboards: []\ndepends_on: []\n---\n# Open a graph\n\n'
                   + ''.join(f'## {s}\n\n{t}\n\n' for s, t in body.items()))
        states = ' | '.join(['—'] * 7)
        story = f'{feature}/stories/GR-01-open-a-graph'
        self.write(f'{story}/story.md',
                   '---\nid: GR-01\ntitle: Open a graph\nfeature: GR-F01\nstatus: idea\npersonas: []\nboards: []\n---\n'
                   '# GR-01 · Open a graph\n\n**As** an Operator **I want** to open a graph **so that** I can read it.\n\n'
                   '## Who can\n\n| Lens | Can |\n|---|---|\n| Admin | yes |\n| Operator | yes |\n\n'
                   '## Flow\n\n```mermaid\nflowchart LR\n  a --> b\n```\n\n'
                   '## Acceptance criteria\n\n| ID | Given | When | Then |\n|---|---|---|---|\n'
                   '| GR-01.1 | a graph | I open it | it shows |\n\n'
                   '## Screens\n\n| Surface | Lens | a | b | c | d | e | f | g |\n|---|---|---|---|---|---|---|---|---|\n'
                   f'| Graph | Admin | {states} |\n| Graph | Operator | {states} |\n')
        self.write(f'{story}/task.md', '| ' + ' | '.join(check.TASK_COLUMNS) + ' |\n|'
                   + '---|' * len(check.TASK_COLUMNS) + '\n')
        with mock.patch.object(check, 'check_surfaces'), mock.patch('builtins.print'):
            self.assertEqual(check.main(write_index=True), 0, check.errors)
        text = (self.specs / 'README.md').read_text()
        self.assertLess(text.index('## Operating system'), text.index('## Capabilities'))
        self.assertIn('[Open a graph](os/graph/features/GR-F01-open-a-graph/feature.md)', text)



JOURNEY = ('---\nid: J01\ntitle: First\npersonas: []\nstories: [{stories}]\nboards: []\n---\n# First\n\n'
           '## The journey\n\n```mermaid\nflowchart TD\n  A([Start]) --> B["GR-01 · Open it"]\n'
           '  B --> C{{"Decide"}}\n  C -->|ask| D["GR-02 · AC-03 · Ask"] --> B\n  C -->|done| E(["{last} · Done"])\n```\n')


class JourneyDiagram(Tree):
    """The ids a journey diagram's steps start with match its ``stories:`` and name stories."""

    def check(self, stories, last, known=('GR-01', 'GR-02', 'AC-03', 'GR-04')):
        path = self.write('specs/journeys/J01-first.md', JOURNEY.format(stories=stories, last=last))
        fm, body = check.front_matter(path, path.read_text())
        check.check_journey_diagram(path, fm, body, dict.fromkeys(known, path))
        return check.errors

    def test_a_diagram_matching_its_stories_passes(self):
        self.assertEqual(self.check('GR-01, GR-02, AC-03, GR-04', 'GR-04'), [])

    def test_an_unknown_id_and_a_mismatch_with_stories_fail(self):
        errors = self.check('GR-01, GR-02, GR-04', 'ZZ-99')
        self.assertTrue(any('`E` starts with `ZZ-99`, which no story defines' in e for e in errors), errors)
        self.assertTrue(any('`stories` names GR-04, not on The journey diagram' in e for e in errors), errors)
        self.assertTrue(any('draws AC-03, missing from `stories`' in e for e in errors), errors)
        self.assertEqual(len(errors), 3, errors)

MILESTONES_MD = ('# Milestones\n\n## Milestones\n\n| ID | Name | Waits on | Done when | Journeys |\n|---|---|---|---|---|\n'
                 '| MVP | MVP | — | x | {cell} |\n\n## How\n')


class Milestones(Tree):
    """``milestone:`` values, parked stories and confirmed milestone journeys are held to milestones.md."""

    def setUp(self):
        super().setUp()
        patch = mock.patch.object(check, 'MILESTONES', self.specs / 'milestones.md')
        patch.start()
        self.addCleanup(patch.stop)

    def docs(self, story_milestones, status='idea', journey_stories='GR-01, GR-02'):
        docs = {}
        for sid, m in story_milestones.items():
            path = self.write(f'specs/os/graph/features/GR-F01-x/stories/{sid}-x/story.md')
            fm = {'id': sid, 'status': status, **({'milestone': m} if m else {})}
            docs[path] = ('story', fm, '')
        path = self.write('specs/journeys/J01-x.md')
        docs[path] = ('journey', {'id': 'J01', 'stories': [s.strip() for s in journey_stories.split(',')]}, '')
        return docs

    def run_check(self, cell, **kw):
        self.write('specs/milestones.md', MILESTONES_MD.format(cell=cell))
        check.check_milestones(self.docs(**kw))
        return check.errors

    def test_a_listed_journey_with_all_its_stories_in_the_milestone_passes(self):
        self.assertEqual(self.run_check('[J01](journeys/J01-x.md)', story_milestones={'GR-01': 'MVP', 'GR-02': 'MVP'}), [])

    def test_an_unknown_milestone_and_a_parked_story_with_one_fail(self):
        errors = self.run_check('—', story_milestones={'GR-01': 'V9'})
        self.assertTrue(any('`V9` is not a row of milestones.md' in e for e in errors), errors)
        check.errors.clear()
        errors = self.run_check('—', story_milestones={'GR-01': 'MVP'}, status='later')
        self.assertTrue(any('a `later` story carries no milestone' in e for e in errors), errors)

    def test_a_confirmed_journey_with_a_story_outside_fails_but_a_proposed_one_does_not(self):
        stories = {'GR-01': 'MVP', 'GR-02': None}
        errors = self.run_check('[J01](journeys/J01-x.md)', story_milestones=stories)
        self.assertTrue(any('lists J01, but GR-02 are not in it' in e for e in errors), errors)
        check.errors.clear()
        self.assertEqual(self.run_check('*Proposed:* [J01](journeys/J01-x.md)', story_milestones=stories), [])


class BoardIds(Tree):
    """Flow and journey board ids follow design-language §7."""

    def test_valid_ids_pass(self):
        check.check_board_ids({'flow.create_agent', 'journey.j01', 'agents.runs'}, {'J01'})
        self.assertEqual(check.errors, [])

    def test_bad_flow_and_journey_ids_fail(self):
        check.check_board_ids({'flow.Create-Agent', 'journey.1', 'journey.j99'}, {'J01'})
        self.assertEqual(len(check.errors), 3, check.errors)
        self.assertTrue(any('journey J99, which no journey defines' in e for e in check.errors))


SCREENS = ('## Screens\n\n| Surface | Lens | a | b | c | d | e | f | g |\n|---|---|---|---|---|---|---|---|---|\n'
           '| Limits | Admin | — | — | — | settings.limits | settings.limits · Could not save | — | — |\n'
           '| Edit | Admin | — | — | — | settings.limits · Edit limits | {extra} | — | — |\n')
FLOW_HTML = '<script>\nconst FLOW = {data};\n</script>\n'


class FlowStates(Tree):
    """Each flow board's frames are in its stories' Screens, and each Screens node is on its click path."""

    def setUp(self):
        super().setUp()
        canvas = self.root / 'canvas' / 'project'
        manifest = self.root / 'canvas' / 'clickthrough' / 'flows.json'
        for p in (mock.patch.object(check, 'CANVAS', canvas), mock.patch.object(check, 'FLOWS_JSON', manifest)):
            p.start()
            self.addCleanup(p.stop)
        frames =[{'n': 1, 'board': 'settings.limits', 'state': 'has data', 'stories': ['CP-11']},
                  {'n': 2, 'board': 'settings.limits', 'state': 'Edit limits', 'stories': ['CP-11']}]
        self.write('canvas/project/flow.set_limits.dc.html',
                   FLOW_HTML.replace('{data}', json.dumps({'id': 'flow.set_limits', 'frames': frames})))
        path = {'name': 'fails', 'steps': [{'click': 'Edit limits', 'state': 'Edit limits'},
                                           {'click': 'Could not save', 'state': 'Could not save'}]}
        self.write('canvas/clickthrough/flows.json', json.dumps({'flows': [
            {'id': 'flow.set_limits', 'status': 'active', 'paths': [path],
             'start': {'board': 'settings.limits', 'view': 'List', 'state': 'has data'}}]}))

    def run_check(self, extra, strict=False):
        story = self.write('specs/s/story.md')
        check.check_flows({story: ('story', {'id': 'CP-11', 'status': 'designed'}, SCREENS.format(extra=extra))},
                          strict=strict)
        return check.warnings, check.errors

    def test_frames_and_paths_covering_the_screens_pass(self):
        self.assertEqual(self.run_check('settings.limits · Could not save'), ([], []))
        self.assertEqual(self.run_check('—', strict=True), ([], []))

    def test_a_loose_frame_and_an_unreached_node_warn_and_fail_with_flows(self):
        self.write('canvas/project/flow.set_limits.dc.html', FLOW_HTML.replace('{data}', json.dumps(
            {'id': 'flow.set_limits', 'frames': [{'n': 1, 'board': 'settings.limits', 'state': 'Saving',
                                                  'stories': ['CP-11']}]})))
        warns, errs = self.run_check('settings.limits · Saved')
        self.assertEqual(errs, [])
        self.assertEqual(len(warns), 1, warns)
        self.assertIn('1 frame(s) in no ## Screens', warns[0])
        self.assertIn('· 1 ## Screens node(s)', warns[0])  # Saved: the flows.json path reaches the rest
        check.warnings.clear()
        _warns, errs = self.run_check('settings.limits · Saved', strict=True)
        self.assertTrue(any('frame 1 `settings.limits · Saving` is in no ## Screens of CP-11' in e for e in errs), errs)
        self.assertTrue(any('`settings.limits · Saved` is reached by no frame of flow.set_limits' in e for e in errs),
                        errs)
        self.assertEqual(len(errs), 2, errs)


class IndexLink(Tree):
    def test_the_index_header_links_milestones(self):
        self.write('specs/milestones.md')
        with mock.patch.object(check, 'MILESTONES', self.specs / 'milestones.md'):
            check.index({}, {})
        self.assertIn('[milestones](milestones.md)', (self.specs / 'README.md').read_text())


if __name__ == '__main__':
    unittest.main()
