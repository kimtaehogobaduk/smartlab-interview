## 2025-05-18 - Pre-indexing Submissions and Scores in Leaderboard Calculations

**Learning:** Computing candidate leaderboard scores via `buildLeaderboard` performed O(C * S * M * K) operations using nested `submissions.filter` and `scores.find` array searches, re-executing on every UI state update.
**Action:** Group collections by lookup keys (e.g., candidate IDs or criteria IDs) using `Map` data structures in a single pass O(S + C * M), and wrap derived component computations in `useMemo` to prevent redundant re-renders.
