## 2026-03-31 - Leaderboard Aggregation Map Pre-grouping

**Learning:** `buildLeaderboard` in `src/lib/scoring.ts` performed nested `.filter()`, `.find()`, and array sorting inside loops for candidates and criteria, turning an $O(C \cdot S)$ task into an expensive $O(C \cdot S \cdot K)$ operation with redundant calculations.
**Action:** Always pre-group submissions by candidate using `Map<candidateId, Submission[]>` and build indexed lookup maps for criteria scores before computing aggregates.
