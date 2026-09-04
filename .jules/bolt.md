## 2025-05-18 - Leaderboard scoring aggregation O(N*K^2) anti-pattern

**Learning:** `buildLeaderboard` in `scoring.ts` performed nested array filtering (`submissions.filter`) per candidate, nested array searching (`s.scores.find`) per criterion, and array searching inside the array sort comparator (`item.perCriterion.find`). Pre-grouping submissions by `candidateId` using a Map and pre-calculating criterion score sums per submission eliminates $O(C \times S + N \times K^2)$ redundant scans and speeds up leaderboard calculation by >10x (~29ms to ~2ms for 100 candidates / 500 submissions).
**Action:** When computing aggregations over relational data structures in React store state, group data with `Map` before looping and pre-calculate comparison metrics outside sorting functions.
