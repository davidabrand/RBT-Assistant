# Reliability / UI Audit — v1.1.106

## Problems confirmed from testing

### 1. Planned values could look like recorded values after a failed write
A failed Partial Interval write was followed by a real Office Puzzle reread, but the weekly strip could still fall back to the saved plan when the live column became blank. Because the compact strip intentionally does not label plan vs recorded values, this could show a stale percentage such as 36% after the user cleared the column.

**Fix:** Failed/stopped dates are now live-truth-only. Until a fresh plan is deliberately created or a later write verifies successfully, the strip renders only Office Puzzle actuals for that date.

### 2. Manual Office Puzzle edits were not guaranteed to refresh side-panel actuals
Program inventory is intentionally locked once learned, so normal DOM revisions on a completed page did not rediscover mappings. That was good for performance, but it meant a manual gear clear could leave cached day actuals visible.

**Fix:** Data-cell DOM mutations now use a separate `data` hint. The side panel performs a debounced current-table actual refresh without waking the full inventory scanner. The passive safety heartbeat also routes completed-page revisions to the same lightweight truth sync.

### 3. Error-dialog close could leave stale state if Office Puzzle's framework emitted no useful mutation
Some framework updates can replace internal state without a mutation shape that the existing discovery observer recognizes.

**Fix:** Closing a stopped/failed writer status forces one current-table truth reconciliation.

### 4. Partial Interval current scans lacked `dailyStates`
The scanner returned `currentStates` and `dailyAverages`, but not the full `dailyStates` history used by the side panel's exact-state logic.

**Fix:** Current Partial Interval and Client 2 Replacement scans now include `dailyStates`.

### 5. Task-removal feedback was redundant
Deleting a task already removes the row immediately. A second toast and hidden auto-run narration added visual noise and extra state writes without helping the RBT.

**Fix:** Task deletion is silent; the list update is the feedback.

## Performance rules retained
- Full real-page scroll scanning remains limited to client/page inventory changes.
- Client-level writable dates remain cached across page types.
- Clinical writer mutations remain suppressed from inventory discovery.
- Live truth sync is debounced and current-table scoped for Partial Interval.

## Intentionally not changed in this pass
- Writer transition timing / click cadence. Correctness is being stabilized before further timing reductions.
- The frequency/X writer, because it is already performing well.
- Major HTML/CSS structural removal of hidden legacy diagnostic elements. Those can be pruned later as a separate low-risk cleanup after writer stability is confirmed.
