# Gemini audit integration — development application

This change integrates the supplied audit modules into the existing vanilla JavaScript application. The original importers, planner, manufacturer charts, Pip assets, guided home, and purchasing/check-in workflows remain in use. No server, account system, or public conversion database was added.

## Entry points

- **My threads → Import a thread list:** opens the existing Smart Stash importer, including file mapping, review, conflict handling, and Undo.
- **Shopping → Take a combined shopping list:** selects active projects and calls `FlossFoxPlanner.compute`. Confirmed stock is subtracted once after requirements are combined. Review items remain separate. Found checkmarks are independent of Bought, Received, and collection quantities.
- **Project editor → Stitching journal:** a collapsed journal with dates, stitches, minutes, notes, recorded thread use, recap, and a chart. Completion percentage uses the existing project progress field and does not change project status.
- **Settings → Advanced color comparison:** enables the separate HEX-to-DMC swatch tool. Existing manufacturer conversions remain the default.
- **Help → Suggest a better thread match:** copies a structured local review report. No submission or publication takes place.

## Data contracts and safeguards

Existing project schema 2 and full-backup version 2 are preserved. New fields are optional and older backups remain readable.

| Key/field | Purpose |
| --- | --- |
| `flossfox-dev.stitch-sessions.v1` | Validated schema-1 session sidecar; bounded to 2,000 logs |
| Full backup `stitchSessions` | Session export; validated and prepared before restore writes |
| Session `archived: true` | Preserves historical logs whose project is absent after a legacy project-only restore; excluded from active project logs |
| `flossfox-dev.store-trip.v1` | Selected projects, calculation signature, and Found marks; no purchasing or inventory writes |
| `flossfox-dev.color-mode.v1` | Opt-in visibility of numerical swatch suggestions |

Session writes verify readback and reject stale revisions. Corrupt session data is preserved and prevents an incomplete backup from being reported as complete. Full restore and Undo verify their writes and attempt rollback on failure. Merge replacement replaces the corresponding project's sessions; copied projects receive remapped session IDs; skipped projects keep their current sessions. Intentional project deletion confirms removal of its logs and preserves a recovery snapshot when possible.

Snapshots include the session sidecar. Backups without `stitchSessions` preserve existing sessions. Unmatched historical records are retained as archived entries in subsequent full backups rather than attached to another project. Archived entries are recoverable in JSON; this release does not add an archive browser.

The development fabric calculator always uses the development namespace, including on localhost. The service worker caches all audit assets under a `flossfox-dev-` cache name, removes superseded development caches, and preserves other sites' caches.

## Sharing and color limitations

Shopping URLs contain only version/type and selected DMC codes/quantities. They are bounded to 250 rows and 6,000 encoded characters, validated on opening, and read-only until explicit import confirmation. Uncertain rows remain uncertain after import. Links are not encrypted and can be forwarded.

CIEDE2000 compares approximate display swatches, not measured physical threads. Results are estimates rather than validated substitutions. Recorded thread use is an estimate entered by the user and never deducts stock. Browser-local data can still be cleared by the browser or user; downloaded backups remain necessary.

## Verification commands

Serve the repository locally with `python3 -m http.server 8765`. Python browser tests require Playwright and Chromium. Where the executable differs from the legacy `/usr/bin/google-chrome` default, set `FF_CHROME` explicitly.

```bash
node tests/audit_unit.cjs
FF_CHROME=/usr/bin/chromium python3 tests/audit_real_e2e.py http://127.0.0.1:8765/
FF_CHROME=/usr/bin/chromium python3 tests/audit_integrity_e2e.py http://127.0.0.1:8765/
FF_KEY=flossfox-dev.v1 FF_CHROME=/usr/bin/chromium tests/run_e2e.sh http://127.0.0.1:8765/
```

`tests/run_e2e.sh` runs the entire historical suite, including areas beyond this integration. The engineering report records the exact subset actually executed and distinguishes viewport emulation from physical-device testing.
