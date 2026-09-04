## 2025-05-18 - Optimized Leaderboard Scoring Calculation Algorithm

**Learning:** `buildLeaderboard` in `src/lib/scoring.ts` previously executed quadratic array scans $O(C \times S)$ by filtering submissions per candidate inside loops and doing repeated $O(K)$ array lookups inside the sort comparator and top criteria checks. Pre-grouping submissions into `Map<string, EvaluationSubmission[]>` and caching average criterion scores in maps reduced complexity to $O(S + C \times K)$.

**Action:** Always pre-aggregate/group sub-arrays into `Map` or hash lookup objects when computing aggregations over parent-child data structures in React state / utility functions.
