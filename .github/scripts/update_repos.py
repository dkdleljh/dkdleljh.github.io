"""Build the public project catalog from GitHub. No private metadata is emitted."""
import argparse
import html
from datetime import datetime
from zoneinfo import ZoneInfo
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.request

OWNER = os.environ.get('GITHUB_OWNER', 'dkdleljh')
ROOT = Path(__file__).resolve().parents[2]


def gh_get(endpoint, *, optional=False):
    token = os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN')
    if not token and os.environ.get('USE_GH_CLI') == '1':
        result = subprocess.run(['gh', 'api', endpoint], capture_output=True, text=True, timeout=45)
        if result.returncode:
            if optional and '(HTTP 404)' in result.stderr:
                return None
            raise RuntimeError(f'GitHub request failed: {endpoint}')
        return json.loads(result.stdout)
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'Zenith-project-catalog'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    request = urllib.request.Request('https://api.github.com/' + endpoint, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        if optional and error.code == 404:
            return None
        raise RuntimeError(f'GitHub returned HTTP {error.code}: {endpoint}') from None


def public_projects(repos):
    return sorted((r for r in repos if r.get('owner', {}).get('login', '').lower() == OWNER.lower()
                   and not r.get('private', True) and not r.get('archived') and not r.get('fork')),
                  key=lambda r: (r['name'] != f'{OWNER}.github.io', r['name'].lower()))


def md(text):
    return html.escape(str(text)).replace('[', '&#91;').replace(']', '&#93;').replace('\n', ' ')


def replace_block(text, begin, end, block):
    if text.count(begin) != 1 or text.count(end) != 1:
        raise ValueError('Expected exactly one pair of catalog markers')
    before, rest = text.split(begin)
    _, after = rest.split(end)
    return before + begin + '\n' + block + '\n' + end + after


def build_catalog():
    repos = []
    page = 1
    while True:
        batch = gh_get(f'users/{OWNER}/repos?per_page=100&page={page}')
        repos.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    records = []
    for repo in public_projects(repos):
        release = gh_get(f"repos/{OWNER}/{repo['name']}/releases/latest", optional=True)
        records.append({
            'name': repo['name'], 'url': repo['html_url'],
            'description': repo.get('description') or '프로젝트 설명은 저장소 README를 참고하세요.',
            'language': repo.get('language') or '문서 / 자료',
            'version': release['tag_name'] if release else None,
            'release_url': release['html_url'] if release else repo['html_url'] + '/releases',
            'release_date': datetime.fromisoformat(release['published_at'].replace('Z', '+00:00')).astimezone(ZoneInfo('Asia/Seoul')).date().isoformat() if release else None,
            'source_date': datetime.fromisoformat(repo['pushed_at'].replace('Z', '+00:00')).astimezone(ZoneInfo('Asia/Seoul')).date().isoformat(),
        })
    if not records:
        raise RuntimeError('Refusing to replace catalog with an empty repository list')
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    records = build_catalog()
    lines = []
    for r in records:
        version = f" · [릴리즈 {md(r['version'])}]({r['release_url']})" if r['version'] else ' · 릴리즈 미등록'
        lines.append(f"- [{md(r['name'])}]({r['url']}) — {md(r['description'])}{version}")
    updates = {ROOT / '_data/projects.json': json.dumps(records, ensure_ascii=False, indent=2) + '\n'}
    for filename in ['index.md', 'links.md']:
        path = ROOT / filename
        updates[path] = replace_block(path.read_text(), '<!-- BEGIN AUTO:REPOS -->', '<!-- END AUTO:REPOS -->', '\n'.join(lines))
    changed = [str(p.relative_to(ROOT)) for p, body in updates.items() if not p.exists() or p.read_text() != body]
    if args.check:
        if changed:
            raise SystemExit('Catalog is stale: ' + ', '.join(changed))
        return
    # All API calls and marker validations succeed before any file is replaced.
    for path, body in updates.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + '.tmp')
        temporary.write_text(body)
        temporary.replace(path)
    print(f'Public projects: {len(records)}; changed files: {len(changed)}')


if __name__ == '__main__':
    main()
