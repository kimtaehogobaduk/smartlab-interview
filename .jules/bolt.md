## 2025-05-18 - Optimized Candidate Submission Grouping & Sorting in Leaderboard

**Learning:** In candidate evaluation Leaderboard calculations, nested `submissions.filter` per candidate resulted in $O(N \times M)$ overhead, and calling array `.find()` inside the sort comparator caused $O(C \times N \log N)$ sorting slowdowns. Pre-grouping submissions into a `Map` by candidate ID and pre-computing primary criterion averages keeps calculations linear and comparator calls $O(1)$.

**Action:** Always pre-group submissions by candidate ID in a Map and pre-compute criterion averages before sorting or determining top criteria. Wrap `buildLeaderboard` calls in `useMemo` in React components to avoid re-calculating on un-related render updates.
