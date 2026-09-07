## 2026-03-31 - Leaderboard Calculation Optimization

**Learning:** `buildLeaderboard` performed $O(N \times S)$ filtering to group submissions by candidate, repeatedly called `Array.prototype.find` on criteria averages during sorting tie-breakers, and used another $O(N)$ `items.find` lookup per criterion for top criteria identification.
**Action:** Use a `Map` to pre-group submissions by candidate ID in $O(S)$ time, cache criterion averages per candidate item for $O(1)$ sort comparisons, and maintain direct references to winning candidate objects during criteria loops.
