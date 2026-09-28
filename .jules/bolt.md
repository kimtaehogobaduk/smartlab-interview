## 2026-03-30 - Map Grouping and Memoization for Leaderboard Calculation
**Learning:** `buildLeaderboard` in `src/lib/scoring.ts` performed $O(N \cdot S)$ filtering of submissions for each candidate and sorted array copies to find primary criteria. Pre-grouping submissions into a `Map<string, EvaluationSubmission[]>` and using `useMemo` in React components prevents redundant computation during re-renders.
**Action:** When working with leaderboard or scoring calculations, always group submissions/scores by candidate ID upfront and memoize the resulting aggregation in UI components.
