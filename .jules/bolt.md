## 2025-05-15 - Leaderboard scoring nested array searches

**Learning:** `buildLeaderboard` in `src/lib/scoring.ts` performed $O(C \times S)$ repeated `submissions.filter` scanning and $O(C \times K \times M)$ linear searches across scores for every candidate render, causing severe UI lag when updating evaluations or viewing the leaderboard with large candidate pools.
**Action:** Group submissions by `candidateId` into a `Map` in $O(S)$ time before processing candidates, and pre-index score lookups for $O(1)$ evaluation per criterion.
