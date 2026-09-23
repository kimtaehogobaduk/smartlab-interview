## 2025-05-18 - Leaderboard Calculation Optimization
**Learning:** In `buildLeaderboard`, repeatedly filtering submissions per candidate and doing `find` lookups inside sorting comparators and winner aggregation loops creates quadratic $O(C \times S)$ time complexity. Pre-indexing with a `Map` and pre-extracting tie-breaker values reduces runtime by ~4.7x on medium batches (50 candidates x 5 panels).
**Action:** Always pre-group relational data with a `Map` when aggregating candidate/submission models, and precompute comparator values before sorting arrays.
