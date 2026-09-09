## 2025-05-18 - Leaderboard Map indexing & React memoization

**Learning:** `buildLeaderboard` in `scoring.ts` performed repeated $O(S)$ candidate submission filtering ($submissions.filter$) and nested $O(N)$ candidate candidate object lookups when assigning top criteria winners. Combined with un-memoized execution in React components, this caused $O(N \cdot S + C \cdot N^2)$ re-computations on every state update. Pre-indexing submissions in a Map and tracking top criterion winning references reduces execution complexity to $O(S + N \cdot C)$.
**Action:** Always pre-index relational arrays into `Map` structures when performing cross-reference aggregations, and wrap non-trivial computation calls in `useMemo` when invoked in React render paths.
