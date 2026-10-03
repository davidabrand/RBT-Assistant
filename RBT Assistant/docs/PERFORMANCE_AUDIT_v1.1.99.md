# Performance audit — v1.1.98 baseline

## Highest-impact findings

1. **Idle wakeups** — route polling ran every 250 ms in every Office Puzzle tab. Side-panel timers also ran at 1.2 s, 5 s and 8 s intervals even when idle.
2. **Write-time observer churn** — a whole-document discovery observer inspected table DOM mutations caused by clinical writes even though inventory discovery is not useful during a write.
3. **Scan-time repeated full DOM parsing** — the real-page lazy scan repeatedly executed overlapping whole-document program-name parsers inside its ~38 ms polling loop.
4. **Global quiet observer** — every verified clinical click started a MutationObserver over the entire Office Puzzle document; unrelated page mutations could extend the settle window.
5. **Duplicate SPA refresh pipelines** — route, DOM, page-guard and heartbeat signals could race and trigger back-to-back refresh/full-scan work for the same page transition.
6. **Unnecessary date settle on same-client page switches** — post-scan context settling could retry for writable dates even though dates are client-level and intentionally reused between Behaviors and Replacements.

## Phase 1 targets

- Idle: eliminate high-frequency polling and wake only on real events or slow safety heartbeats.
- Page switching: exactly one deliberate inventory scan per client/page transition.
- Scanner: wait cheaply for lazy-load progress and parse the DOM only when it changed.
- Writes: keep exact verification but silence unrelated discovery work and scope settle observation to the active program table.

## Deferred for live testing

- Measure actual per-cell transition time on Office Puzzle after this pass.
- Measure memory after repeated client/page switches.
- If writer remains slow, profile mapping rereads (`replacementFromMapping`, `challengingIntervalFromMapping`, `graphFromMapping`) and reduce full-table rescans while preserving exact post-click verification.
