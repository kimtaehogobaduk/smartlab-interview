## 2025-05-18 - Fail-Secure Admin Code Verification
**Vulnerability:** Throwing an unhandled exception when `ADMIN_ACCESS_CODE` environment variable was missing leaked server configuration details (`ADMIN_ACCESS_CODE가 설정되지 않았습니다.`) to unauthenticated clients.
**Learning:** Server-side auth handlers should return `{ valid: false }` or fail securely without revealing server environment state or variable names.
**Prevention:** Avoid throwing environment configuration errors in client-facing server functions; log configuration warnings server-side and fail auth checks securely.
