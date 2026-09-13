## 2025-05-18 - Pre-grouping submissions and memoizing leaderboard calculations

**Learning:** `buildLeaderboard` performed O(N*M*S) array filters and inner `.find` searches on every render. Pre-grouping submissions into Maps and indexing `perCriterion` directly reduced complexity from O(C*S*M*K + M^2*C) to O(S + C*S*M). In React, wrapping `buildLeaderboard` in `useMemo` avoids recalculations when track filters change or parent components re-render.
**Action:** Always pre-index relational array data (like submissions by candidate) with Map data structures before nested processing loops.
