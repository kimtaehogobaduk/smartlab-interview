# Bolt Journal

## 2026-03-30 - Map-based lookup optimization in scoring leaderboard

**Learning:** `buildLeaderboard` performed $O(C \times S + C \times M \times S)$ filtering and linear `.find()` operations for each candidate and evaluation criterion. Pre-grouping submissions into a `Map<candidateId, EvaluationSubmission[]>` and caching criterion averages in nested Maps reduced overhead to linear time $O(S + C \times M)$.
**Action:** When calculating aggregated scores or statistics across relational entities in client-side state, index arrays by key into `Map` structures before looping over candidates/items.
