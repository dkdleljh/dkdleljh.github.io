import os
import re
import json
import requests
from datetime import datetime, timezone
from pathlib import Path

OWNER = os.environ.get('GITHUB_OWNER', 'dkdleljh')
TOKEN = os.environ.get('GITHUB_TOKEN') or os.environ.get('REPO_PAT')

API = 'https://api.github.com'

headers = {'Accept': 'application/vnd.github+json'}
if TOKEN:
    headers['Authorization'] = f'Bearer {TOKEN}'


def gh_get(url, params=None):
    r = requests.get(url, headers=headers, params=params)
    if r.status_code >= 400:
        raise RuntimeError(f'GitHub API error {r.status_code}: {r.text[:200]}')
    return r


def list_repos(owner):
    # paginate
    repos = []
    page = 1
    while True:
        r = gh_get(f'{API}/users/{owner}/repos', params={'per_page': 100, 'page': page, 'sort': 'pushed'})
        batch = r.json()
        if not batch:
            break
        repos.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return repos


def normalize_desc(name, desc):
    desc = (desc or '').strip()
    if desc:
        return desc
    low = name.lower()
    if low.endswith('.github.io'):
        return 'GitHub Pages 기반 개인 브랜딩 블로그'
    if 'wiki' in low:
        return '특정 주제(인물) 중심 위키/문서화 프로젝트'
    if 'collector' in low:
        return '사진/이미지 수집·정리 자동화 도구'
    return '설명 업데이트 예정'


def build_home_block(repos):
    # Only include selected repos (pin-set) first, then rest (optional)
    # For now: include all non-archived, non-fork, owned.
    items = []
    for r in repos:
        if r.get('fork'):
            continue
        if r.get('archived'):
            continue
        name = r['name']
        url = r['html_url']
        private = r.get('private', False)
        desc = normalize_desc(name, r.get('description'))
        # Always link; private will 404 for others (acceptable per user request).
        items.append((name, url, desc, private))

    # sort: blog repo first, then by name
    def key(t):
        name=t[0]
        if name == f'{OWNER}.github.io':
            return (0, name.lower())
        return (1, name.lower())

    items.sort(key=key)

    lines = []
    for name, url, desc, private in items:
        lines.append(f'- [{name}]({url}) — {desc}')
    ts = datetime.now(timezone.utc).astimezone().strftime('%Y-%m-%d %H:%M %z')
    lines.append('')
    lines.append(f'<!-- updated: {ts} -->')
    return '\n'.join(lines).strip() + '\n'


def build_projects_block(repos):
    # richer index list
    items=[]
    for r in repos:
        if r.get('fork') or r.get('archived'):
            continue
        name=r['name']
        url=r['html_url']
        private=r.get('private', False)
        desc=normalize_desc(name, r.get('description'))
        items.append((name,url,desc,private))
    items.sort(key=lambda t: (0 if t[0]==f'{OWNER}.github.io' else 1, t[0].lower()))

    lines=['### All repositories','']
    for name,url,desc,private in items:
        lines.append(f'- [{name}]({url}) — {desc} ({"Private" if private else "Public"})')
    ts=datetime.now(timezone.utc).astimezone().strftime('%Y-%m-%d %H:%M %z')
    lines += ['','<!-- updated: %s -->'%ts]
    return '\n'.join(lines).strip()+'\n'


def replace_block(path, begin, end, new_block):
    p=Path(path)
    text=p.read_text()
    if begin not in text or end not in text:
        raise RuntimeError(f'markers missing in {path}')
    pre=text.split(begin)[0]
    post=text.split(end)[1]
    p.write_text(pre+begin+'\n'+new_block+end+post)


def main():
    repos=list_repos(OWNER)
    home_block=build_home_block(repos)
    projects_block=build_projects_block(repos)

    replace_block('index.md','<!-- BEGIN AUTO:REPOS -->','<!-- END AUTO:REPOS -->',home_block)
    replace_block('links.md','<!-- BEGIN AUTO:REPOS -->','<!-- END AUTO:REPOS -->',home_block)
    replace_block('projects.md','<!-- BEGIN AUTO:REPO-LIST -->','<!-- END AUTO:REPO-LIST -->',projects_block)

if __name__=='__main__':
    main()
