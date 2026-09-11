## 2026-03-31 - Leaderboard & Scoring Map Optimization

**Learning:** Scoring calculation (`buildLeaderboard`) performed nested $O(N^2)$ linear searches (`Array.prototype.find` and `Array.prototype.filter`) across candidates, submissions, and criteria. Pre-indexing submissions and criterion scores into `Map` data structures reduced evaluation time from $O(C \cdot S \cdot M)$ to $O(C + S \cdot M)$.
**Action:** When calculating aggregated scores or rendering leaderboards across multiple entities, group submissions into a Map indexed by candidate ID and criteria scores upfront.
