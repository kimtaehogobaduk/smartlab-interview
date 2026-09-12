## 2026-03-31 - Grouping submissions in buildLeaderboard

**Learning:** `buildLeaderboard` previously executed an $O(M)$ `.filter()` array scan for each candidate inside an $O(N)$ candidate iteration, resulting in quadratic $O(N \cdot M)$ computational complexity when calculating leaderboards for large candidate/submission pools. Additionally, finding the winner item for top criteria performed an unnecessary $O(N)$ lookup per criterion.
**Action:** Group `submissions` upfront into a `Map<string, EvaluationSubmission[]>` in $O(M)$ time and retain a direct reference to the winning leaderboard item during criterion iteration.
