## 2025-05-18 - Leaderboard Calculation Optimization

**Learning:** `buildLeaderboard` in `scoring.ts` performed nested array operations (`submissions.filter(...)`, `.map()`, `.find()`) inside candidate iteration and tie-breaker sorting loops, resulting in $O(N^2 \cdot C)$ complexity that scales poorly when evaluation counts grow.

**Action:** Pre-group submissions by `candidateId` into a `Map` in $O(S)$ time, aggregate criterion scores in a single pass per candidate, pre-calculate primary criterion scores for $O(1)$ sorting comparison lookups, and index `perCriterion` by array position rather than calling `.find()` in inner loops.
