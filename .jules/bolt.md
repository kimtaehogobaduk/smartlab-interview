## 2026-09-16 - Leaderboard calculation map grouping and indexing optimization
**Learning:** In scoring/leaderboard routines with candidates, criteria, and submissions, performing repeated `.filter()` and `.find()` queries leads to quadratic nested loops. Pre-grouping submissions in a `Map<candidateId, EvaluationSubmission[]>` and indexing criteria scores in array order reduces runtime from O(N * S * K) to O(S + N * K + N log N).
**Action:** When computing aggregated scores across multiple entities and nested criteria, pre-index or map array collections before looping over candidates.
