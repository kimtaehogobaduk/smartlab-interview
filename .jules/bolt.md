## 2025-05-18 - Pre-indexing submissions and memoizing scoring in client-side state architecture
**Learning:** In a local/client-side state architecture where candidate evaluation state updates frequently (e.g. range sliders, live transcript notes), inline $O(N^2)$ scoring and candidate array filtering in React components cause frequent main-thread jank.
**Action:** Always pre-group submissions by candidate ID into a `Map` upfront and memoize `buildLeaderboard` computations with `useMemo`.
