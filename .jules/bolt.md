## 2026-03-31 - Leaderboard Aggregation Map Indexing

**Learning:** In `buildLeaderboard`, repeatedly searching submissions and criteria arrays with `.find()` inside nested loops caused $O(N \cdot S \cdot K^2)$ execution time (~65ms for 200 candidates & 600 submissions). Pre-grouping submissions into Maps and pre-indexing scores per submission reduced complexity to $O(S \cdot K + N \cdot K)$ (~6ms, over 7x speedup).

**Action:** When aggregating multi-dimensional evaluation data (candidates x submissions x criteria), always pre-group collections with `Map` before iterating, and avoid `.find()` within render-blocking calculation loops.
