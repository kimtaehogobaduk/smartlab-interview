## 2025-05-20 - Submissions and Leaderboard Aggregation Indexing

**Learning:** `buildLeaderboard` repeatedly filtered all submissions by `candidateId` and performed `.find()` lookups on `perCriterion` arrays within nested criteria loops, leading to O(N * M + K * N * (K + N)) complexity during live evaluation calculations.
**Action:** Always pre-group submissions by candidate ID into a `Map` and index `perCriterion` arrays or retain direct references to candidate leaderboard objects before running multi-criterion aggregation loops.
