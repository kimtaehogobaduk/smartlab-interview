## 2025-05-18 - Constant-Time String Comparison for Access Codes
**Vulnerability:** String comparison using `===` in server functions (e.g., `verifyAdminCode`) is susceptible to timing side-channel attacks, leaking secret length and prefix character timing.
**Learning:** `crypto.timingSafeEqual` in Node.js requires equal buffer byte lengths. Passing raw inputs directly to `timingSafeEqual` throws a `RangeError` when input lengths differ, which itself leaks string length via exception timing.
**Prevention:** Compute fixed 32-byte SHA-256 digests (`crypto.createHash('sha256')`) of both the secret and user input before passing digests to `crypto.timingSafeEqual(hashA, hashB)`.
