Changelog
=========

All notable changes to this project are documented here. Dates are in YYYY‑MM‑DD.


v1.0.2 – 2025‑09‑13
-------------------

Highlights
- Full offline mode: all JS/CSS assets loaded locally from `assets/` (React UMD, ReactDOM UMD, Babel standalone, Tailwind frozen CSS). No CDN, no network calls.
- Robust PyInstaller support (One‑Dir and One‑File):
  - Proper `resource_path` handling for both source and bundled runs (`sys._MEIPASS`).
  - One‑File uses a temporary HTML file to enable relative paths to `assets/`.
  - Packaging includes `assets/` and `rolomemo_component.js`.
- Windows WebView backend: force Edge (WebView2) to avoid legacy MSHTML/IE hangs.
- Persistent profile for WebView2 (no reset of localStorage/cookies between runs).

New features
- Settings:
  - Dedicated Settings popup (header icon) with App info and options.
  - Auto‑start toggle on Windows (HKCU\Run) with status check and update.
  - Theme selector with 3 themes: Retro (default), Dark, Zen.
  - Custom card palette: enable/disable, add/remove colors, quick reset.
  - Changing theme updates memo colors when custom palette is disabled (index‑based map).
- Tags:
  - Sidebar: add new tags and delete existing ones; shows per‑tag counts; quick filter.
  - Card (expanded):
    - Suggestion dropdown for “aggiungi tag” with existing tags; “+ aggiungi …” only if not existing.
    - Remove assigned tags inline.
    - Suggestion menu renders above the card (portal), not clipped by the card container.
- Editor (card expanded):
  - Right‑click context menu with Copy / Cut / Paste / Select all. Paste improved via Clipboard API fallback.
  - Text formatting toolbar: Bold, Italic, Underline, Bullet list.
  - Keyboard shortcuts: Ctrl/Cmd + B/I/U; Tab / Shift+Tab to indent/outdent list items.
  - Markdown‑like helpers for bullet lists (e.g., “- ”); safe HTML sanitization on paste.

Fixes & improvements
- Avoid startup freeze in venv by using Edge backend and showing JS errors inline for quick diagnosis.
- Babel inline with extra plugins (optional chaining, nullish coalescing, class fields, object rest/spread).
- Safer data dir detection on Windows; backup rotation; improved logging with UTF‑8.

CI / Release
- Windows workflow builds both One‑Dir and One‑File, zips them, and attaches to tag releases (`v*`).
- Removed obsolete offline HTML generation step from Actions; optional local helper script still available.


v1.0.0 – 2025‑09‑08
-------------------
- Initial public release (source code only).

