"""
Generate dist/index.html offline from rolomemo.create_html.
Run inside the repo root with the project venv activated.
"""
from __future__ import annotations

from pathlib import Path
import sys


def main() -> None:
    # Ensure project root on sys.path for 'import rolomemo'
    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    import rolomemo as app  # requires pywebview to be importable

    html = app.create_html()
    app.DIST_DIR.mkdir(parents=True, exist_ok=True)
    app.INDEX_HTML.write_text(html, encoding="utf-8")
    size = app.INDEX_HTML.stat().st_size
    print(f"Wrote {app.INDEX_HTML} ({size} bytes)")


if __name__ == "__main__":
    main()
