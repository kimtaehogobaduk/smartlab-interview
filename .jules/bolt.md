## 2026-03-01 - Leaderboard scoring & sorting bottlenecks
**Learning:** In candidate evaluation scoring, calculating criterion averages and tie-breaking repeated `array.find()` inside candidate loops, sorting comparators, and top criteria loops. Grouping submissions by `candidateId` and indexing criterion scores into `Map` lookups reduces `buildLeaderboard` complexity from $O(C \cdot S \cdot K)$ to $O(S + C \cdot K)$.
**Action:** Always pre-group submissions by candidate ID into a `Map` and index criterion scores before sorting or calculating leaderboard metrics.
