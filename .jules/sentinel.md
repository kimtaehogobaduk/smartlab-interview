# Sentinel Journal - Critical Learnings

## 2025-05-18 - Upstream Error Body Leakage in Server Functions

**Vulnerability:** External AI API responses (`body.slice(0, 300)`) were included in thrown exception messages on failure, exposing raw upstream error payloads to client UI responses.
**Learning:** Returning truncated error bodies directly to callers can leak API credentials, internal server paths, or rate limiting metadata returned by upstream providers.
**Prevention:** Always log complete error details on the server using `console.error` and throw sanitized, safe error messages to clients without raw response bodies.
