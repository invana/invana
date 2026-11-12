"""Tests for check.py: the operating-system and capability areas, and the ``specs/_stale/`` rules.

    python3 -m unittest discover -s scripts/specs

Each test builds a small spec tree in a temporary folder and points the checker at it. Standard library only.
"""
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
        patches = [mock.patch.object(check, 'ROOT', self.root), mock.patch.object(check, 'SPECS', self.specs)]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        check.errors.clear()
        self.addCleanup(check.errors.clear)
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


if __name__ == '__main__':
    unittest.main()
