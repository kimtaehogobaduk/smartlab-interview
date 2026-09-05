## 2025-05-18 - Constant-Time Admin Code Verification

**Vulnerability:** In `src/lib/auth.functions.ts`, admin authentication relied on string equality (`===`) for validating secret access codes (`ADMIN_ACCESS_CODE`), exposing the admin code to potential timing side-channel attacks.
**Learning:** `crypto.timingSafeEqual` throws an error if buffer lengths differ. To perform constant-time comparisons securely without throwing on variable-length inputs, length checks must still run dummy `timingSafeEqual` operations on identical buffers before returning `false`.
**Prevention:** Always compare sensitive secrets, hashes, or tokens using constant-time buffer comparison utilities (`crypto.timingSafeEqual`).
