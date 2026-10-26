#!/usr/bin/env python3
"""Check the development scaffold; application checks are configured separately."""

from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {
    ".git", ".venv", "venv", "node_modules", "__pycache__", ".cache",
    ".pytest_cache", ".mypy_cache", ".ruff_cache", "artifacts", "local",
    "dist", "build", "coverage", "htmlcov", "tmp",
}
REQUIRED = (
    "README.md", "AGENTS.md", "CLAUDE.md",
    ".gitignore", ".editorconfig", "Makefile", "scripts/check_repo.py",
    "docs/development.md", "docs/status.md", "docs/code-map.md",
    "docs/decisions/README.md", "docs/decisions/TEMPLATE.md", "changes/README.md",
    "changes/TEMPLATE.md", "changes/0001-agent-preparation.md",
    ".agents/skills/implement-change/SKILL.md",
    ".agents/skills/review-change/SKILL.md",
)
TEXT_SUFFIXES = {
    ".md", ".py", ".toml", ".yaml", ".yml", ".json",
    ".ts", ".tsx", ".js", ".css", ".html",
}
TEXT_NAMES = {"Makefile", ".gitignore", ".editorconfig"}
LINK = re.compile(r"\[[^\]\n]*\]\(([^)\n]+)\)")


def source_files(directory):
    for path in sorted(directory.iterdir()):
        if path.is_symlink():
            continue
        if path.is_dir() and path.name not in SKIP_DIRS:
            yield from source_files(path)
        elif path.is_file() and (
            path.suffix in TEXT_SUFFIXES or path.name in TEXT_NAMES
        ):
            yield path


def check():
    errors = []
    for name in REQUIRED:
        if not (ROOT / name).is_file():
            errors.append(f"missing required file: {name}")

    files = list(source_files(ROOT))
    for path in files:
        name = str(path.relative_to(ROOT))
        try:
            content = path.read_bytes().decode("utf-8")
        except UnicodeDecodeError:
            errors.append(f"{name}: must be UTF-8")
            continue
        if "\r" in content:
            errors.append(f"{name}: use LF line endings")
        if content and not content.endswith("\n"):
            errors.append(f"{name}: missing final newline")
        for number, line in enumerate(content.splitlines(), 1):
            if line.rstrip() != line:
                errors.append(f"{name}:{number}: trailing whitespace")
        if path.suffix != ".md":
            continue
        # Only inline links in prose: ignore fenced code and inline code examples.
        prose = re.sub(r"```[^\n]*\n.*?```", "", content, flags=re.S)
        prose = re.sub(r"`[^`\n]+`", "", prose)
        for raw in LINK.findall(prose):
            target = raw.strip().split(' "', 1)[0].strip("<>")
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            destination = path.parent / unquote(parsed.path)
            if not destination.exists():
                errors.append(f"{name}: broken local link: {target}")

    # Avoid picking up a parent repository; support both .git dir and worktree file.
    if (ROOT / ".git").exists():
        result = subprocess.run(
            ["git", "diff", "--check", "HEAD"], cwd=ROOT,
            capture_output=True, text=True,
        )
        # An initialized repository has no HEAD until its first commit.
        if result.returncode == 128:
            result = subprocess.run(
                ["git", "diff", "--check"], cwd=ROOT,
                capture_output=True, text=True,
            )
        if result.returncode:
            errors.append("git diff --check failed: " + result.stdout + result.stderr)
    else:
        print("NOTE: no local Git repository; patch check skipped")

    if errors:
        for error in errors:
            print("FAIL:", error, file=sys.stderr)
        return 1
    print(f"PASS: {len(REQUIRED)} preparation files; {len(files)} text files checked")
    print("PASS: local inline Markdown link targets and text formatting")
    print("NOTE: application tests, type checking and builds are not covered")
    return 0


if __name__ == "__main__":
    raise SystemExit(check())
