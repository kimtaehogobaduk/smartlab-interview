## 2026-03-30 - Prevent Exposing Upstream AI API Error Bodies in Server Functions

**Vulnerability:** Upstream API error response bodies containing potential secrets, internal headers, or gateway details were sliced and directly included in thrown Error messages in server functions, exposing internal API details to client applications.
**Learning:** Slicing raw HTTP response bodies into client-facing thrown errors leaks internal upstream gateway error details when API calls fail.
**Prevention:** Log detailed raw error bodies on the server side using `console.error` and throw generic, sanitized error messages to the client.
