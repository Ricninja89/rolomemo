"""
Generate dist/index.html offline from rolomemo.create_html.
Run inside the repo root with the project venv activated.

Note: This helper does NOT rely on rolomemo.DIST_DIR/INDEX_HTML constants,
which may not exist in current versions. It simply writes dist/index.html.
"""
from __future__ import annotations

from pathlib import Path
import sys


def main() -> None:
    # Ensure project root on sys.path for 'import rolomemo'
    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    import rolomemo  # requires pywebview to be importable

    html = rolomemo.create_html()
    dist_dir = Path('dist')
    out_html = dist_dir / 'index.html'
    dist_dir.mkdir(parents=True, exist_ok=True)
    out_html.write_text(html, encoding='utf-8')
    size = out_html.stat().st_size
    print(f"Wrote {out_html} ({size} bytes)")


if __name__ == "__main__":
    main()
