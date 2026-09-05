## 2026-03-31 - Pre-grouping nested linear scans in evaluation scoring

**Learning:** Filtering `submissions` inside a `candidates` loop resulted in an O(C * S) bottleneck in `buildLeaderboard`. Additionally, using `.find()` inside nested loops for criterion lookups during scoring, tie-breaking, top criteria assignment, and CSV generation multiplied operations exponentially. Pre-grouping submissions into a `Map<string, EvaluationSubmission[]>` and pre-indexing criterion scores reduced runtime from ~14.3ms to ~3.3ms for 500 candidates and 2,000 submissions (~4.3x speedup).

**Action:** Whenever computing aggregate calculations across relational arrays (like candidates and submissions), always pre-group data into `Map` lookups before entering loops instead of doing repeated `.filter()` or `.find()` calls.
