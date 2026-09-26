## 2026-03-31 - Leaderboard scoring complexity reduction and React memoization

**Learning:** In SmartLab, `buildLeaderboard` filters `submissions` by `candidateId` for every candidate in a loop ($O(C \times S)$) and performs nested criterion lookups ($O(C \times K^2)$). Furthermore, `<Leaderboard />` calls `buildLeaderboard` directly on render without `useMemo`, triggering calculations whenever local filter state changes.
**Action:** Group submissions by `candidateId` upfront into a Map ($O(S)$), perform single-pass score aggregation per candidate, and wrap the `buildLeaderboard` call in `useMemo` in UI components.
