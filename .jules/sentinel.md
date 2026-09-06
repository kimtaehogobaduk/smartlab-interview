## 2026-03-01 - Constant-time comparison for TanStack Start server authentication

**Vulnerability:** String equality (`===`) comparison in `verifyAdminCode` allowed timing side-channel attacks when checking the secret `ADMIN_ACCESS_CODE`.
**Learning:** TanStack Start server functions wrapped with `createServerFn` require server context during execution in unit tests. Extracting pure security comparison logic into exported helpers (e.g. `checkAdminCode` using `node:crypto`'s `timingSafeEqual`) enables direct, fast unit testing without server-context mocking overhead.
**Prevention:** Always isolate secret validation logic into constant-time buffer comparison functions (`crypto.timingSafeEqual`) and test the validation logic directly.
