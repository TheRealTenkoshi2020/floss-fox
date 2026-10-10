# Floss Fox
Static DMC → Anchor floss converter. No build step: open `index.html`.

- Rename: change `APP_NAME` in index.html.
- Affiliate disclosure: set `SHOW_AFFILIATE_DISCLOSURE = true` in index.html once links exist.
- Live at https://therealtenkoshi2020.github.io/floss-fox/ . Contact via GitHub Issues.
- `?sample` auto-fills an example list (handy for testing).
- Data: Cyberstitchers conversion charts (see footer/About).

## Tests
Headless regression suite: `python3 -m http.server 8765` in this folder, then
`python tests/regression.py http://localhost:8765/` (needs `pip install playwright` and Chrome at /usr/bin/google-chrome, or pass `--chrome PATH`).
Run against the live site with `python tests/regression.py https://therealtenkoshi2020.github.io/floss-fox/`. Add `--shots DIR` to save screenshots.

## Projects storage
Projects are stored in `localStorage` under `flossfox.v1` (schema 1, see `projects.js`). Unreadable or newer-schema data is never overwritten. Backups are JSON (`app: "floss-fox"`).
