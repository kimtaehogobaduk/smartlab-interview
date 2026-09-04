## 2026-03-31 - Fix timing side-channel attack in admin code verification
**Vulnerability:** Admin access code comparison used standard string equality (`===`), which terminates early on character mismatches and creates a timing side-channel vulnerability.
**Learning:** `crypto.timingSafeEqual` in Node.js throws an exception if the input buffers are not of equal length. Comparing length before calling `timingSafeEqual` is necessary, but must be handled carefully so string length differences do not bypass constant-time execution.
**Prevention:** Always compare secret keys/tokens with a timing-safe helper (`crypto.timingSafeEqual`) that normalizes or safely handles length differences in constant time.
