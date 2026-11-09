# Verified restore confirmation - design and plan

Inspection: backup import (Merge / Replace, full or older projects-only) already keeps a pre-import copy
(Undo last import) and shows "Restore done" from in-memory results. "applied but NOT saved" could leave a
partial write. Restoring an automatic copy writes raw keys and reloads with no confirmation afterwards.

Design (reuses existing paths, no consent changes, no migration):
- New `restore-verify.js` (pure, Node testable): verifyKeys(expected, get), writeKeys(keys, set, remove),
  importMessage(result), copyMessage(result).
- Import: take an in-memory copy of the affected keys (`snapshot()`) right before any write. After saving,
  read back projects, threads (full backups) and restored preferences and compare to exactly what was meant
  to be saved. Only then show "Restore checked and saved" with real counts and totals, in the restore panel
  (stays visible, no reload). Journal re-base only after a verified save.
- If a save fails or the read-back differs: write the in-memory copy back, read it back too, then reload so
  the screen matches storage and show (via sessionStorage, once) either "nothing was changed" (verified) or a
  clear "could not confirm, use Undo last import" warning. Never claims success.
- Automatic copy restore: after writing, read every key back; on mismatch write the previous values back
  (existing pattern) and say so. On success record {at, from, sig} in its own meta key; after the reload the
  Automatic copies box shows "Restored and checked" with counts only if current storage still matches sig.
- Limits: verification is a same-browser read-back, not a guarantee against later browser clean-up; the
  allocations rollback path is unchanged.

Tests first: tests/restore_verify_unit.cjs, tests/restore_verify_e2e.py.

## Follow-up: failure paths (baseline vs this change)
- Baseline (main, simulated probe): when the project save fails mid-import, the thread collection is already
  written, projects are not, the message says "applied but NOT saved", and the next normal edit silently writes
  the imported projects. Partial writes existed before this change.
- Now: any failed save, read-back mismatch or unexpected error is put back from an in-memory copy and read
  back again; project saves are paused until the immediate reload; the result is carried across the reload
  (sessionStorage) and the backup box opens so Undo last import is in view. The pre-import copy is never removed.
- If putting back also fails, storage can still hold the same kind of partial state as baseline (every value
  written is a pre-import value, so no new data is introduced). The user gets a "could not confirm" warning and
  Undo last import restores the exact pre-import keys. localStorage has no transactions, so this is
  best effort with verification, not atomic.
- Remaining limits: the warning shows once after the reload (not persisted if sessionStorage is unavailable,
  in which case the reload waits 6 s with saves paused); if the pre-import copy could not be saved (user chose
  "Import anyway") and put-back fails, there is no automatic recovery beyond automatic copies.
