# Bolt's Journal - Critical Performance Learnings

This journal tracks critical performance insights, bottlenecks, and anti-patterns specific to this codebase.

## 2026-03-31 - Leaderboard Aggregation & Submission Lookups

**Learning:** `buildLeaderboard` in `scoring.ts` performed $O(N \times M)$ array filtering on `submissions` per candidate, combined with $O(C^2)$ score lookups per submission and $O(K \log K \cdot C)$ array searches during tie-breaker sorting. Pre-grouping `submissions` by candidate into a `Map` and indexing scores by `criterionId` reduced runtime from ~26ms to ~7ms for 200 candidates (~3.5x speedup / 70% reduction).

**Action:** When working with leaderboard aggregation or multi-criterion evaluation scoring, always pre-group relational data with `Map`s and attach lookup structures to avoid nested array `.filter()` or `.find()` operations in hot paths and sorting comparators.
