import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('catalog', Path(__file__).resolve().parents[1] / '.github/scripts/update_repos.py')
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)


class CatalogTests(unittest.TestCase):
    def test_private_fork_archived_and_foreign_repos_are_excluded(self):
        public = {'name': 'public', 'owner': {'login': catalog.OWNER}, 'private': False}
        cases = [public, dict(public, private=True), dict(public, fork=True), dict(public, archived=True),
                 dict(public, owner={'login': 'someone-else'}), {'name': 'unknown'}]
        self.assertEqual(catalog.public_projects(cases), [public])

    def test_failed_markers_do_not_silently_discard_page(self):
        with self.assertRaises(ValueError):
            catalog.replace_block('a BEGIN b', 'BEGIN', 'END', 'new')
        with self.assertRaises(ValueError):
            catalog.replace_block('BEGIN END BEGIN END', 'BEGIN', 'END', 'new')
        self.assertEqual(catalog.replace_block('a BEGIN old END z', 'BEGIN', 'END', 'new'), 'a BEGIN\nnew\nEND z')

    def test_description_cannot_inject_html_or_markdown_links(self):
        self.assertNotIn('<script>', catalog.md('<script>[x](bad)\ntext'))
        self.assertNotIn('[x]', catalog.md('<script>[x](bad)\ntext'))


if __name__ == '__main__':
    unittest.main()
