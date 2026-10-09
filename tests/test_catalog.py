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

    def test_unknown_history_does_not_invent_a_development_date(self):
        self.assertEqual(catalog.project_history('new-repo', {}), {
            'development_date': None, 'first_commit_url': None, 'date_note': None,
        })

    def test_history_retains_evidence_and_archive_note(self):
        history = {'development_date': '2026-03-29', 'first_commit': 'a' * 40,
                   'date_note': '배포 파일 보관소의 기록 시작일'}
        result = catalog.project_history('example', {'example': history})
        self.assertEqual(result['development_date'], '2026-03-29')
        self.assertEqual(result['first_commit_url'],
                         f'https://github.com/{catalog.OWNER}/example/commit/' + 'a' * 40)
        self.assertEqual(result['date_note'], history['date_note'])

    def test_invalid_dates_and_commit_ids_are_rejected(self):
        for date, sha in [('2026-02-30', 'a' * 40), ('2026-3-1', 'a' * 40),
                          ('2026-03-01', '../../invalid'), ('2026-03-01', 'a' * 7)]:
            with self.subTest(date=date, sha=sha), self.assertRaises(ValueError):
                catalog.project_history('example', {'example': {
                    'development_date': date, 'first_commit': sha,
                }})


if __name__ == '__main__':
    unittest.main()
