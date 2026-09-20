## 2025-05-10 - Pre-grouping Submissions & Map Caching in Scoring Algorithms
**Learning:** `buildLeaderboard` performed $O(C \times S \times K)$ array searches per candidate and submission when aggregating scores and finding tie-breakers. Pre-grouping submissions by `candidateId` into a Map and aggregating criterion sums in a single pass reduces complexity to $O(S + C \times K)$.
**Action:** When working with candidate/submission data processing in this app, always group related entities into Maps before nested calculations to avoid quadratic array scans.
