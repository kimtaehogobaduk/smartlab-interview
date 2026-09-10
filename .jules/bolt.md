## 2025-05-18 - Leaderboard Calculation & Store Re-renders Optimization

**Learning:** In this application, `buildLeaderboard` in `src/lib/scoring.ts` performs complex multi-criteria evaluation scoring. Calling `buildLeaderboard` unmemoized in component render loops leads to repeated expensive array scans (`.filter`, `.find`) on every store update (e.g. log additions, text inputs). Using `Map` pre-indexing reduces time complexity from $O(N \cdot S \cdot C)$ to $O(N + S + C)$, and wrapping component calls in `useMemo` avoids redundant re-computations on unrelated store updates.
**Action:** Always pre-group submissions by candidate/criterion with `Map` lookups before aggregation loops, and memoize leaderboard queries at the React layer.
