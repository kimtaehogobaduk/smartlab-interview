# Bolt's Journal

## 2026-03-31 - Pre-grouping Submissions and Direct Index Lookup in Leaderboard Computation
**Learning:** `buildLeaderboard` performed O(N * S) filtering for candidate submissions, nested `s.scores.find(...)` for each criterion, O(N log N) `.find()` calls during tie-breaker sorting, and O(C * N) `items.find(...)` calls to assign top criteria.
**Action:** Pre-group submissions by candidate into a `Map<string, Submission[]>`, map score lookups per submission, and use direct `cIdx` array indexing for criterion averages to reduce complexity to O(S + N * C).
