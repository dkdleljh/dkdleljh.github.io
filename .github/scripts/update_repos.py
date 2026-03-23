import os
import re
import json
import requests
from datetime import datetime, timezone
from pathlib import Path

OWNER = os.environ.get("GITHUB_OWNER", "dkdleljh")
TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("REPO_PAT")

API = "https://api.github.com"

headers = {"Accept": "application/vnd.github+json"}
if TOKEN:
    headers["Authorization"] = f"Bearer {TOKEN}"


def gh_get(url, params=None):
    r = requests.get(url, headers=headers, params=params)
    if r.status_code >= 400:
        raise RuntimeError(f"GitHub API error {r.status_code}: {r.text[:200]}")
    return r


def list_repos(owner):
    # paginate
    repos = []
    page = 1
    while True:
        r = gh_get(
            f"{API}/users/{owner}/repos",
            params={"per_page": 100, "page": page, "sort": "pushed"},
        )
        batch = r.json()
        if not batch:
            break
        repos.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return repos


def normalize_desc(name, desc):
    desc = (desc or "").strip()
    if desc:
        return desc
    low = name.lower()
    if low.endswith(".github.io"):
        return "GitHub Pages 기반 개인 브랜딩 블로그"
    if "wiki" in low:
        return "특정 주제(인물) 중심 위키/문서화 프로젝트"
    if "collector" in low:
        return "사진/이미지 수집·정리 자동화 도구"
    if low in ("kis-orb-vwap-bot", "kis_orb_vwap_bot") or "orb" in low:
        return "KIS 기반 자동매매(ORB/VWAP) — KR/US 모듈형 트레이딩 봇"
    if low in ("upbit_bot", "upbit-bot") or "upbit" in low:
        return "업비트 현물 자동매매 봇 (paper/backtest/live)"
    if "adaptive_vb" in low or "pairbot" in low:
        return "페어봇: KIS Adaptive Volatility Breakout (KODEX ETF 페어)"
    return "설명 업데이트 예정"


def latest_release(owner: str, repo: str):
    """Return (tag_name, html_url) for latest release if exists, else None."""
    try:
        r = gh_get(f"{API}/repos/{owner}/{repo}/releases/latest")
        data = r.json()
        tag = data.get("tag_name")
        url = data.get("html_url")
        if tag and url:
            return str(tag), str(url)
    except Exception:
        return None
    return None


def build_home_block(repos):
    # Only include selected repos (pin-set) first, then rest (optional)
    # For now: include all non-archived, non-fork, owned.
    items = []
    for r in repos:
        if r.get("fork"):
            continue
        if r.get("archived"):
            continue
        name = r["name"]
        url = r["html_url"]
        private = r.get("private", False)
        desc = normalize_desc(name, r.get("description"))

        rel = None
        # Only decorate a few repos with release link (keep API calls bounded)
        if name in {
            "kis-orb-vwap-bot",
            "upbit_bot",
            "goyoonjung_photo_collector",
            "kis_adaptive_vb_bot",
            "universe-live",
        }:
            rel = latest_release(OWNER, name)

        items.append((name, url, desc, private, rel))

    # sort: blog repo first, then by name
    def key(t):
        name = t[0]
        if name == f"{OWNER}.github.io":
            return (0, name.lower())
        return (1, name.lower())

    items.sort(key=key)

    lines = []
    for name, url, desc, private, rel in items:
        if rel:
            tag, rurl = rel
            lines.append(f"- [{name}]({url}) — {desc} · 최신 릴리즈: [{tag}]({rurl})")
        else:
            lines.append(f"- [{name}]({url}) — {desc}")

    ts = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M %z")
    lines.append("")
    lines.append(f"<!-- updated: {ts} -->")
    return "\n".join(lines).strip() + "\n"


def build_projects_block(repos):
    # richer index list
    items = []
    for r in repos:
        if r.get("fork") or r.get("archived"):
            continue
        name = r["name"]
        url = r["html_url"]
        private = r.get("private", False)
        desc = normalize_desc(name, r.get("description"))

        rel = None
        if name in {
            "kis-orb-vwap-bot",
            "upbit_bot",
            "goyoonjung_photo_collector",
            "kis_adaptive_vb_bot",
        }:
            rel = latest_release(OWNER, name)

        items.append((name, url, desc, private, rel))

    items.sort(key=lambda t: (0 if t[0] == f"{OWNER}.github.io" else 1, t[0].lower()))

    lines = ["### All repositories", ""]
    for name, url, desc, private, rel in items:
        vis = "Private" if private else "Public"
        if rel:
            tag, rurl = rel
            lines.append(
                f"- [{name}]({url}) — {desc} ({vis}) · 최신 릴리즈: [{tag}]({rurl})"
            )
        else:
            lines.append(f"- [{name}]({url}) — {desc} ({vis})")

    ts = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M %z")
    lines += ["", "<!-- updated: %s -->" % ts]
    return "\n".join(lines).strip() + "\n"


def replace_block(path, begin, end, new_block):
    p = Path(path)
    text = p.read_text()
    if begin not in text or end not in text:
        raise RuntimeError(f"markers missing in {path}")
    pre = text.split(begin)[0]
    post = text.split(end)[1]
    p.write_text(pre + begin + "\n" + new_block + end + post)


def main():
    repos = list_repos(OWNER)
    home_block = build_home_block(repos)
    projects_block = build_projects_block(repos)

    replace_block(
        "index.md", "<!-- BEGIN AUTO:REPOS -->", "<!-- END AUTO:REPOS -->", home_block
    )
    replace_block(
        "links.md", "<!-- BEGIN AUTO:REPOS -->", "<!-- END AUTO:REPOS -->", home_block
    )
    replace_block(
        "projects.md",
        "<!-- BEGIN AUTO:REPO-LIST -->",
        "<!-- END AUTO:REPO-LIST -->",
        projects_block,
    )


if __name__ == "__main__":
    main()
