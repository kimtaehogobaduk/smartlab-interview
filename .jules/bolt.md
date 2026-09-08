## 2026-03-30 - O(C*S*K) Leaderboard Aggregation Bottleneck

**Learning:** Un-indexed evaluation submissions and criterion score linear searches (`array.find`) inside leaderboard loops caused $O(C \cdot S \cdot K)$ work on every state update or component render. Pre-grouping submissions into a `Map` by candidate ID and accumulating scores in a single pass reduced calculations to $O(C + S + C \cdot K \log C)$, while pre-calculating primary tie-breaker values eliminated array searches in `sort()` comparators.
**Action:** When performing aggregate metrics or rankings across collections, always pre-index related collections into `Map` structures and pre-calculate comparison metrics before sorting.
