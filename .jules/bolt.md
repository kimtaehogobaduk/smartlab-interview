## 2026-03-31 - Leaderboard Aggregation Optimization (O(N*C) vs O(C*N*C))

**Learning:** In scoring/leaderboard routines where candidates are matched against submissions and criteria, performing nested `Array.prototype.find` and `Array.prototype.filter` inside multiple loops causes quadratic/cubic growth on re-renders. Indexing submissions by `candidateId` into a `Map` upfront (O(S)) and reusing per-candidate criterion averages eliminates quadratic scans during sorting, tie-breaking, and top-criteria determination.
**Action:** Always index flat arrays into `Map` lookups before running aggregation logic that evaluates multiple criteria across datasets.
