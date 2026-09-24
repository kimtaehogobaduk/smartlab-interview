# Bolt's Journal - Critical Performance Learnings

## 2026-03-31 - Leaderboard aggregation index lookup optimization

**Learning:** `buildLeaderboard` in `src/lib/scoring.ts` previously filtered submissions by candidate ID (`submissions.filter(...)`) for every candidate ($O(N \times S)$) and searched scores per criterion using `.find()`. Pre-indexing submissions into a Map (`submissionsByCandidate`) and using direct sum loops eliminates redundant array allocations and cuts complexity from $O(N \times S + N \times M^2)$ to $O(S + N \times M)$.
**Action:** When working with leaderboard, scoring, or batch processing functions in React state stores, pre-index relational arrays into `Map` structures before looping over items.
