## 2025-05-18 - Constant-Time Admin Access Code Comparison
**Vulnerability:** Admin authentication in `verifyAdminCode` (`src/lib/auth.functions.ts`) was using standard equality (`data.code === expected`), making secret comparison vulnerable to timing side-channel attacks.
**Learning:** `timingSafeEqual` in Node.js `crypto` requires equal byte-length buffers; passing buffers of different lengths throws a RangeError exception.
**Prevention:** Always compare buffer lengths before executing `timingSafeEqual`, returning `false` early if lengths differ, to ensure safe constant-time comparison without runtime errors.
