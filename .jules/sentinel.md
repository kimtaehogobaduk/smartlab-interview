# Sentinel Security Journal

## 2026-03-31 - Constant-Time String Comparison for Secret Verification
**Vulnerability:** Standard equality operators (`===`) short-circuit on character mismatches or length differences, introducing timing side-channel vulnerabilities during secret code verification.
**Learning:** In TanStack Start server functions executing on Node server runtimes, secret comparisons should hash strings to fixed-length SHA-256 digests and compare them with `node:crypto`'s `timingSafeEqual`.
**Prevention:** Always use `safeCompare` or `timingSafeEqual` with fixed-size digests when verifying access tokens, passcodes, or API keys.
