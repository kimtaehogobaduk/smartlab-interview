# Bolt's Journal - Critical Performance Learnings

## 2026-03-30 - O(N*M) Leaderboard Calculation Bottleneck
**Learning:** In scoring calculation modules (e.g., `buildLeaderboard`), repeated calls to `submissions.filter()` per candidate and `.find()` per criterion across candidates created an $O(\text{candidates} \times \text{submissions} \times \text{criteria})$ bottleneck. Pre-grouping submissions into a `Map<string, Submission[]>` and maintaining criterion average maps reduced runtime by ~84% (from ~221ms to ~35ms for 500 candidates / 2500 submissions).
**Action:** When computing aggregated stats across nested lists, pre-index with Maps/Hashtables instead of calling `.filter()` and `.find()` inside loops.
