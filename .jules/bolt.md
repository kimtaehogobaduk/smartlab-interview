## 2026-03-29 - Single-pass Map grouping for leaderboard calculations
**Learning:** Scoring and leaderboard calculations that repeatedly execute `submissions.filter()` per candidate cause unnecessary O(C * S) scans and memory allocations on re-renders. Pre-grouping submissions into a Map in O(S) time significantly improves evaluation pipeline performance.
**Action:** Always pre-group collection lookups by key using Map or record maps when processing multi-entity aggregates.
