# Bolt's Journal - Performance Learnings

## 2026-03-31 - Leaderboard aggregation map indexing

**Learning:** In candidate evaluation systems, aggregating scores with nested `.filter()` and `.find()` per candidate, per criterion, and during sort comparison causes quadratic time complexity $O(C \cdot S + C \cdot S \cdot K + C \log C \cdot K)$ where $C$ is candidates, $S$ is submissions, $K$ is criteria count. Map indexing submissions and criteria scores converts lookups to $O(1)$.
**Action:** Always pre-group submissions by candidate ID and map scores by criterion ID when aggregating multi-submission metrics.
