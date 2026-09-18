# Sentinel Security Journal

## 2026-03-29 - Prevent Sensitive Upstream API Error Disclosure in Server Functions

**Vulnerability:** Upstream AI API Gateway error responses were slicing and returning raw response bodies (`body.slice(0, 300)`) in thrown server errors, exposing upstream credentials, stack traces, and internal service payloads to client applications.
**Learning:** Returning exception details from server-side functions (such as TanStack Start `createServerFn`) directly transmits error messages to the browser client.
**Prevention:** Always sanitize exception messages thrown by server functions to client callers, while recording detailed raw error responses server-side via logger / `console.error`.
