## 2025-05-18 - Optimize Scoring Aggregation and Leaderboard Memoization
**Learning:** Performing repeated `submissions.filter()` and inner `scores.find()` queries in scoring loops (`buildLeaderboard`) leads to $O(C \times S \times K^2)$ complexity, and calling `buildLeaderboard` unmemoized on every component render causes unnecessary recalculations.
**Action:** Pre-group submissions by candidate ID with `Map` lookups in $O(S)$ time, pre-index criteria scores per submission, and wrap leaderboard data calculations in React components with `useMemo`.
