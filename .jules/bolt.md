## 2026-03-31 - Leaderboard Aggregation & Submission Indexing

**Learning:** `buildLeaderboard` performed O(N * M) candidate submission array filtering and O(N * M * K) criterion score array searches on every render. Pre-grouping submissions into a `Map<string, EvaluationSubmission[]>` and indexing submission scores by criterion ID reduces submission lookups from O(N * M) to O(M) and criterion score lookups to O(1).
**Action:** When working with submission or score aggregation in this app, index collections with `Map` before iterating over candidates or criteria, and memoize `buildLeaderboard` in React components.
