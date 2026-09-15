## 2026-03-31 - Leaderboard scoring aggregation optimization

**Learning:** Repeated `.filter()` and `.find()` operations inside candidate evaluation loops create $O(C \times S \times K^2)$ performance bottlenecks on leaderboard calculations when panel submission counts grow. Using `Map` pre-grouping and direct index arrays reduces total complexity to $O(S \times K + C \log C)$.
**Action:** Always pre-group submissions by entity ID into a `Map` when aggregating candidate scores or stats across multiple evaluator submissions.
