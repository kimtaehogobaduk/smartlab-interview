## 2026-03-30 - Map Indexing and Component Memoization for Leaderboard Scoring

**Learning:** In React stores where global state updates on frequent events (e.g., live interview notes/transcripts), unmemoized scoring functions like `buildLeaderboard` re-run continuously. Using `Map` indexing for relational data (submissions, criterion scores) and precomputing primary criteria averages before sorting reduces leaderboard computation complexity from O(C*S*criteria*scores + N log N*criteria) to O(S + C*criteria + N log N).
**Action:** Always wrap global-store-derived collection processing in `useMemo` at the component layer and index multi-key entity associations with `Map` lookups.
