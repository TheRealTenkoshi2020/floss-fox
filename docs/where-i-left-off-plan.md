# "Where I left off" note - design and plan

Inspection: projects already have a general `notes` field (2000 chars, "Project details", placeholder about where
threads are kept, printed on the plan). Reusing it would reinterpret existing saved notes, so it stays exactly as is.

Design (smallest additive change, existing proven pattern):
- Optional project field `leftOff` (string, max 500 chars). Only present once the user saves a non-blank note;
  clearing it removes the field. No migration; existing projects unchanged until a note is saved.
- `norm()` keeps it (`str(..,500)`, non-strings dropped), so import, backups and automatic copies carry it;
  older backups without it import unchanged. Older builds simply ignore the field.
- UI: one plain textarea labelled "Where I left off (optional)" in the open project, outside the collapsed
  Project details, with a one-line hint. Saves on change like Notes (`touch(p)` -> existing save with its
  existing failure message). Rendered with `esc()` / textarea value. Not printed, not in the journal.
- No milestones, points, journal categories, network or Pip changes.

Tests first: tests/where_left_off_e2e.py.
