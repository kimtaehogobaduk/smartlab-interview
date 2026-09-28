# Bolt Journal - Critical Learnings

## 2025-05-10 - O(N*M) lookups in leaderboard calculation

**Learning:** `buildLeaderboard` repeatedly searched submissions and scores using array `.filter()` and `.find()` methods inside nested loops ($O(N \times M \times K)$). Grouping submissions by `candidateId` using `Map` and indexing criterion averages optimizes computation time significantly ($O(M + N \times K)$).
**Action:** Always pre-group related array collections into `Map` lookups before running nested iterations over datasets in hot scoring or analytics paths.
