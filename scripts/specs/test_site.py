"""Tests for the spec site's build hook (site/hooks.py): the graph panel, the neighbourhood, banners and analysis pages.

    python3 -m unittest discover -s scripts/specs

Each test parses a small fixture spec tree (``test_graph.SpecTree``) and renders it with the hook's pure functions —
no MkDocs needed. Standard library only.
"""
import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_graph import SpecTree  # noqa: E402

_spec = importlib.util.spec_from_file_location('spec_site_hooks', Path(__file__).resolve().parent / 'site' / 'hooks.py')
hooks = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(hooks)

MO_F01 = 'capabilities/model/features/MO-F01-x/feature.md'
GR_F01 = 'os/graph/features/GR-F01-x/feature.md'


class Site(SpecTree):
    def index(self):
        return hooks.Index(self.graph())

    def test_a_feature_page_links_what_it_depends_on_and_what_uses_it(self):
        folder = self.feature('MO-F01', depends='GR-F01')
        self.feature('GR-F01')
        self.story(folder, 'MO-04', 'MO-F01')
        ix = self.index()
        md = hooks.graph_section(ix, MO_F01)
        self.assertIn('=== "Depends on', md)
        self.assertIn(f'[`GR-F01` GR-F01 title]({hooks.href(MO_F01, GR_F01)})', md)
        self.assertIn('| `PART_OF` | [`MO-04` MO-04](stories/MO-04-x/story.md) |', md)
        self.assertIn('no `nfrs:` in its front-matter', md)
        self.assertIn('    ```mermaid\n    flowchart LR', md)
        self.assertIn('-->|DEPENDS_ON|', md)
        self.assertEqual(hooks.href(MO_F01, GR_F01), '../../../../os/graph/features/GR-F01-x/feature.md')

    def test_loops_and_gaps_come_from_the_parsers_analysis(self):
        self.feature('MO-F01', depends='GR-F01', nfrs='')
        self.feature('GR-F01', depends='MO-F01', nfrs='')
        ix = self.index()
        self.assertIn('In loop 1', hooks.graph_section(ix, MO_F01))
        loops = hooks.loops_page(ix)
        self.assertIn('1 loops', loops)
        self.assertIn(f'[`GR-F01` GR-F01 title]({GR_F01})', loops)
        self.assertIn('[`MO-F01` MO-F01 title]', hooks.gaps_page(ix))

    def test_a_page_with_no_node_gets_no_panel_and_a_label_cannot_break_mermaid(self):
        self.feature('MO-F01')
        ix = self.index()
        self.assertEqual(hooks.graph_section(ix, 'vision.md'), '')
        ix.nodes['MO-F01']['title'] = 'Say "no" [here]'
        self.assertNotIn('"no"', hooks.mermaid_label(ix, 'MO-F01'))
        self.assertIn('No loops.', hooks.loops_page(ix))

    def test_only_a_placeholder_page_gets_the_banner(self):
        md = hooks.banner('# System design\n\nBody.\n')
        self.assertTrue(md.startswith('# System design\n\n!!! warning "Placeholder"'))
        self.assertIn('Body.', md)
        self.write('specs/system-design.md', '---\ntitle: System design\nstatus: placeholder\n---\n\n# System design\n\n'
                                             '## 1. Context\n\n> Placeholder — what.\n')
        self.feature('MO-F01')
        self.write('specs/journeys/J09-placeholder.md', '---\nid: J09\ntitle: Placeholder\nstatus: placeholder\n'
                                                        'personas: []\nstories: []\nboards: []\n---\n# J09\n')
        ix = self.index()
        self.assertTrue(hooks.is_placeholder_page(ix, 'system-design.md', {'status': 'placeholder'}))
        self.assertTrue(hooks.is_placeholder_page(ix, 'journeys/J09-placeholder.md', {}))
        self.assertFalse(hooks.is_placeholder_page(ix, MO_F01, {'status': 'idea'}))
        self.assertEqual(hooks.tags_for(ix, MO_F01, {'status': 'idea', 'personas': ['modeller']}),
                         ['kind: feature', 'status: idea', 'persona: modeller'])

    def test_the_tree_reads_titles_from_front_matter_and_a_story_folder_is_one_entry(self):
        self.story(self.feature('MO-F01'), 'MO-04', 'MO-F01')
        self.write('specs/os/graph/features/notes/readme.md', '# Notes\n')
        story = 'capabilities/model/features/MO-F01-x/stories/MO-04-x/'
        tree = nest(['vision.md', 'capabilities/model/product.md', MO_F01, story + 'story.md', story + 'task.md',
                     'os/graph/product.md', 'os/graph/features/notes/readme.md'])
        indexes = []
        items = hooks.fold_nav(self.index(), tree, indexes.append)
        self.assertEqual(outline(items), [
            ('Capabilities', [('MO · Model', ['MO · Model', ('MO-F01 · MO-F01 title', [
                'MO-F01 · MO-F01 title', 'MO-04 · MO-04'])])]),
            ('Operating system', [('GR · Graph', ['GR · Graph', ('Notes', ['readme'])])]),
            'vision',
        ])
        self.assertEqual({p.file.src_uri for p in indexes}, {'capabilities/model/product.md', MO_F01,
                                                             'os/graph/product.md'})
        self.assertNotIn(story + 'task.md', [p.file.src_uri for p in hooks.nav_pages(items)])


def nest(paths):
    """The tree MkDocs nests from ``paths`` with no ``nav:`` — sections titled from folder slugs, files sorted."""
    root = {}
    for p in sorted(paths):
        *folders, _ = p.split('/')
        node = root
        for f in folders:
            node = node.setdefault(f, {})
        node[p] = None

    def items(node):
        out = []
        for key, child in node.items():
            if child is None:
                title = key.rsplit('/', 1)[-1].removesuffix('.md')
                out.append(SimpleNamespace(is_section=False, title=title, file=SimpleNamespace(src_uri=key)))
            else:
                out.append(SimpleNamespace(is_section=True, title=key.replace('-', ' ').capitalize(),
                                           children=items(child)))
        return out

    return items(root)


def outline(items):
    return [(i.title, outline(i.children)) if i.is_section else i.title for i in items]
