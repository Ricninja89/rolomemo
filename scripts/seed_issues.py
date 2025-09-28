#!/usr/bin/env python3
"""
Seed GitHub labels and issues from a JSON definition.

Usage (locally):
  GITHUB_TOKEN=<token> GITHUB_REPOSITORY=<owner>/<repo> python scripts/seed_issues.py

Usage (CI):
  Uses env GITHUB_TOKEN provided by GitHub Actions and GITHUB_REPOSITORY context.
"""

import json
import os
import sys
from pathlib import Path
import time
import urllib.request

API = "https://api.github.com"


def gh_request(method: str, path: str, data: dict | None = None):
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        print("Missing GITHUB_TOKEN/GH_TOKEN in environment", file=sys.stderr)
        sys.exit(1)
    url = API + path
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "rolomemo-issue-seeder"
    }
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            text = resp.read().decode("utf-8")
            if text:
                return json.loads(text)
            return {}
    except urllib.error.HTTPError as e:
        err_text = e.read().decode("utf-8", errors="ignore")
        print(f"HTTP {e.code} for {method} {path}: {err_text}", file=sys.stderr)
        raise


def ensure_labels(owner: str, repo: str, labels: list[dict]):
    # Fetch existing labels to avoid duplicates
    existing = {}
    page = 1
    while True:
        res = gh_request("GET", f"/repos/{owner}/{repo}/labels?per_page=100&page={page}")
        if not res:
            break
        for l in res:
            existing[l["name"]] = l
        if len(res) < 100:
            break
        page += 1
    for lbl in labels:
        name = lbl.get("name")
        color = (lbl.get("color") or "ededed").lstrip("#")
        desc = lbl.get("description") or ""
        if name in existing:
            try:
                gh_request("PATCH", f"/repos/{owner}/{repo}/labels/{name}", {"new_name": name, "color": color, "description": desc})
                print(f"Updated label: {name}")
            except Exception:
                print(f"Skipped updating label: {name}")
        else:
            gh_request("POST", f"/repos/{owner}/{repo}/labels", {"name": name, "color": color, "description": desc})
            print(f"Created label: {name}")


def list_all_issues(owner: str, repo: str) -> list[dict]:
    collected: list[dict] = []
    page = 1
    while True:
        res = gh_request("GET", f"/repos/{owner}/{repo}/issues?state=all&per_page=100&page={page}")
        if not res:
            break
        collected.extend(res)
        if len(res) < 100:
            break
        page += 1
        if page > 20:
            break  # safety cap
    return collected


def create_or_update_issues(owner: str, repo: str, issues: list[dict]):
    existing = list_all_issues(owner, repo)
    by_title = {i.get("title", ""): i for i in existing if "pull_request" not in i}
    for idx, item in enumerate(issues, 1):
        title = item.get("title", "Untitled").strip()
        body = item.get("body", "").strip()
        labels = item.get("labels", [])
        if title in by_title:
            num = by_title[title].get("number")
            gh_request("PATCH", f"/repos/{owner}/{repo}/issues/{num}", {"title": title, "body": body, "labels": labels})
            print(f"Updated issue: {title}")
        else:
            payload = {"title": title, "body": body, "labels": labels}
            gh_request("POST", f"/repos/{owner}/{repo}/issues", payload)
            print(f"Created issue: {title}")
        time.sleep(0.4)


def main():
    repo_env = os.environ.get("GITHUB_REPOSITORY")
    if not repo_env or "/" not in repo_env:
        print("Set GITHUB_REPOSITORY as 'owner/repo'", file=sys.stderr)
        sys.exit(1)
    owner, repo = repo_env.split("/", 1)
    tasks_path = Path(__file__).resolve().parents[1] / "project_management" / "tasks.json"
    if not tasks_path.exists():
        print(f"tasks.json not found at {tasks_path}", file=sys.stderr)
        sys.exit(1)
    data = json.loads(tasks_path.read_text(encoding="utf-8"))
    labels = data.get("labels", [])
    issues = data.get("issues", [])
    ensure_labels(owner, repo, labels)
    create_or_update_issues(owner, repo, issues)
    print("Done seeding labels and issues.")


if __name__ == "__main__":
    main()
