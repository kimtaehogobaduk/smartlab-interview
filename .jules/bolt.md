## 2026-09-06 - Pre-grouping Submissions & Pre-caching Sort Keys in Scoring Calculations

**Learning:** In scoring and leaderboard systems, filtering an un-indexed submissions array inside a candidate loop produces $O(C \times S)$ time complexity. Furthermore, searching array elements inside Array.prototype.sort comparators causes $O(N \log N \times K)$ repeated array traversals.
**Action:** Always pre-group submissions into a `Map<candidateId, Submission[]>` ($O(S)$) and pre-extract primary sort properties into a Map ($O(N)$) before sorting.
