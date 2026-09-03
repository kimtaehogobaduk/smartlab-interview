## 2026-03-31 - Scoring & Leaderboard Algorithmic Optimization
**Learning:** In interview and scoring apps, candidate submissions and criteria are frequently iterated over. Using `Array.prototype.find()` inside nested loops for each criterion and candidate creates $O(N \cdot M \cdot C)$ overhead.
**Action:** Group submissions by `candidateId` upfront using `Map` and index score arrays into Map lookups. Pre-index primary sort keys before calling `Array.prototype.sort()` to prevent repeated linear searches inside sort comparators.
