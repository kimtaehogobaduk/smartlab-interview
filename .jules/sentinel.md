# Sentinel Journal 🛡️

## 2026-05-18 - Prevent Timing Side-Channel Attacks in Server Functions

**Vulnerability:** Standard string equality (`===`) in `verifyAdminCode` was susceptible to timing side-channel attacks when verifying administrative access codes.
**Learning:** Standard string comparisons in JavaScript short-circuit upon finding the first character mismatch, allowing attackers to measure microscopic response time differences to deduce secret access codes character by character.
**Prevention:** Always use constant-time string comparison (`crypto.timingSafeEqual`) for sensitive token, password, or access code comparisons in server-side handlers.
