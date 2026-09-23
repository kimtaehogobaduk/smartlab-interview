# Bolt's Performance Journal

## 2026-03-31 - Leaderboard Aggregation & Submission Lookups
**Learning:** `buildLeaderboard` in `src/lib/scoring.ts` performed $O(C \times S)$ array filtering per candidate on evaluation submissions and recomputed scores on every render.
**Action:** Group submissions by `candidateId` into a `Map` ($O(S)$ setup, $O(1)$ lookup) and memoize leaderboard results with `useMemo` in UI components rendering leaderboards.
