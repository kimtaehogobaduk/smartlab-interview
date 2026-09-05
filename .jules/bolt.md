## 2026-03-01 - Optimizing buildLeaderboard scoring aggregation

**Learning:** Data aggregation functions called during React render cycles (such as `buildLeaderboard`) can degrade main-thread performance when doing quadratic `Array.filter` scans and nested `.find()` calls across candidates, submissions, and criteria. Pre-grouping items into `Map` structures and doing single-pass accumulations avoids repeated array allocations and search passes.

**Action:** Look for data aggregation functions invoked in render paths that do nested `.filter()` or `.find()` loops across arrays, and replace them with `Map` grouping or single-pass accumulators.
