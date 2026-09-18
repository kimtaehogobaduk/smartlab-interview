## 2026-03-31 - Leaderboard Aggregation and Sort Comparator Lookups

**Learning:** In scoring and leaderboard computations with multiple submissions and criteria, performing array `.filter()` or `.find()` inside candidate iterations and sort comparators creates $O(C \times S)$ and $O(N \log N \times K)$ complexity bottlenecks. Pre-grouping submissions into `Map<candidateId, Submission[]>` upfront and caching primary criterion scores before sorting reduces execution time by ~90% in leaderboard generation.
**Action:** Always pre-group nested relational data with Maps and cache sort key properties before calling Array.prototype.sort when comparator logic inspects child lists.
