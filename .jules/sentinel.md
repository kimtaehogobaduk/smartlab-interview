# Sentinel Security Journal

## 2026-03-30 - Constant-Time Authentication Code Comparison

**Vulnerability:** String comparison (`data.code === expected`) in `verifyAdminCode` was vulnerable to timing side-channel attacks where an attacker could deduce secret characters based on response latency variations.
**Learning:** `timingSafeEqual` from `node:crypto` requires equal buffer lengths. If lengths differ, comparing `bufA` against `bufA` allows constant-time execution while correctly returning `false`.
**Prevention:** Always use timing-safe comparison functions when verifying credentials or secret tokens against user inputs.
