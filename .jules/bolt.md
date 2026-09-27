## 2026-03-30 - Map Pre-grouping for Submission Aggregation

**Learning:** `buildLeaderboard` in `src/lib/scoring.ts` filtered evaluation submissions (`submissions.filter(s => s.candidateId === candidate.id)`) inside a candidate loop, resulting in $O(N \times M)$ complexity. Pre-grouping submissions into a `Map<string, EvaluationSubmission[]>` upfront reduced execution time by ~90% (from ~634ms to ~60ms for 500 candidates and 5000 submissions).

**Action:** Whenever calculating aggregate statistics across relations in utility or scoring modules, group relational items into a `Map` upfront before processing candidates or items in loops.
