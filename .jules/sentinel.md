## 2025-05-18 - Admin Access Code Timing Side-Channel Vulnerability

**Vulnerability:** Comparing secret admin access codes using standard string equality (`===`) in `verifyAdminCode` server function allows timing side-channel attacks.
**Learning:** Standard string equality (`===`) short-circuits on the first mismatched character, leaking timing information about how many characters match the secret `ADMIN_ACCESS_CODE`.
**Prevention:** Always use constant-time comparison functions (e.g. `timingSafeEqual` from `node:crypto`) when verifying secrets, access tokens, API keys, or passwords.
