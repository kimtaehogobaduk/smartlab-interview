# Bolt's Journal - Critical Learnings

## 2026-03-29 - Leaderboard Aggregation Quadratic Anti-Pattern

**Learning:** In scoring/leaderboard systems, calculating criterion averages across submissions using nested `find` calls on scores arrays ($O(K)$ per submission per criterion) creates $O(C \times S \times K^2)$ runtime overhead. Pre-indexing submissions by candidate and scores by criterion ID reduces execution complexity to $O(S \times K)$.
**Action:** Always pre-group submissions by candidate and scores by criterion ID into Maps or lookup objects before multi-pass score aggregations.
