# Sentinel Security Journal

## 2025-05-18 - Timing-Safe Admin Code Comparison
**Vulnerability:** Direct string equality comparison (`===`) in server functions when validating secret access codes (`ADMIN_ACCESS_CODE`) exposed the verification process to timing side-channel attacks.
**Learning:** Node's `crypto.timingSafeEqual` requires inputs of identical buffer lengths. When comparing strings of differing lengths, executing a dummy timing-safe comparison prevents execution time variation and prevents length/byte timing side-channel leaks.
**Prevention:** Use `safeCompare` constant-time helper using `timingSafeEqual` for all secret or access code comparisons.
