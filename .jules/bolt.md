## 2026-03-31 - Leaderboard Aggregation Optimization

**Learning:** `buildLeaderboard` in `scoring.ts` previously ran $O(N \times S)$ filtering inside candidate loops to retrieve candidate submissions, along with multiple inline `.map()`, `.find()`, and array copy operations when computing criteria score averages and primary sorting weights. Grouping submissions by `candidateId` into a `Map` prior to candidate iterations reduces submission search complexity to $O(S)$, while pre-indexing primary criteria weights and direct array indexing avoids redundant array searching inside sort loops.

**Action:** In scoring/aggregation routines that filter multi-relational arrays per entity, always pre-group relational items into a `Map` or hash table upfront before processing loop entities.
