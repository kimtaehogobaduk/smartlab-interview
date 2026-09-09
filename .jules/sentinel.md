# Sentinel Security Journal

## 2025-02-28 - Timing attack mitigation for secret comparison
**Vulnerability:** Direct string comparison (`===`) in `verifyAdminCode` exposed the admin access code to side-channel timing attacks.
**Learning:** `crypto.timingSafeEqual` throws a `RangeError` if buffer lengths differ.
**Prevention:** Always hash variable-length strings with SHA-256 before `timingSafeEqual` to guarantee constant 32-byte buffers.
