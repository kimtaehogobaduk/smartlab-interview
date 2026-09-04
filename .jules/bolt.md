# Bolt's Journal

## 2026-03-30 - O(N*M*C) Overhead in Scoring/Leaderboard Aggregation

**Learning:** `buildLeaderboard` in `src/lib/scoring.ts` performed `submissions.filter` per candidate, followed by nested `criteria.items.map` and `scores.find` lookups for each submission. When building leaderboards across many candidates and submissions, this quadratic nested array iteration scaled poorly (O(N * M * C)).
**Action:** Group submissions by candidate ID upfront using a `Map` in O(M) time, single-pass accumulate criterion scores, and cache per-item criterion averages to eliminate repeated array scans during sorting and top-criteria calculations.
