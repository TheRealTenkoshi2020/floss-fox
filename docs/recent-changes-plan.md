# Recent changes (Phase 2, read-only view) - design and plan

Approved scope (Myke, "Okay, impliment"): a plain, read-only list of the Phase 1 journal under Settings.

- New file `recent-changes.js`: pure core `FlossFoxRecentCore.describe(events, ctx)` (Node testable) plus browser glue.
- Reads the journal only through `FlossFoxJournal.events()` (non-mutating `localStorage.getItem` + parse).
  Never calls record/rebase/write; never writes any storage key; renders on demand when the `<details>` opens.
- Inventory: "Floss 310: 2 skeins -> 3 skeins" style text (with "plus a partial"), added/removed.
  Project: project name (looked up read-only, else "A project no longer saved") with status labels from projects.js.
  Shopping: restock flag on/off or a project color marked / unmarked Need to buy.
- Codes are shown as codes only; no color names are looked up or invented. Unknown or malformed events are skipped
  and counted. All user strings go through textContent.
- Newest first, 25 at a time with a Show more button. Local dates via toLocaleString.
- Honest limits note: keeps the latest 500 changes, quick undo within 10 minutes in the same visit may combine
  or remove entries, changes in another tab may be missing, not a full history.
- No edit, delete or undo controls. No new event kinds. No network.

Tests first: `tests/recent_changes_unit.cjs` (core), `tests/recent_changes_e2e.py` (page: no writes, XSS, mobile).
