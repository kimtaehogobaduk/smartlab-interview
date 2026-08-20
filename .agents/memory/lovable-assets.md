---
name: Lovable asset portability
description: Cross-environment handling for imported Lovable asset references.
---

Use workspace-local public assets for shared branding and static media instead of relying only on Lovable-generated asset URLs.

**Why:** Lovable asset proxy URLs can return 404 when the same imported project is previewed on Replit.

**How to apply:** Keep the source asset in public/ and reference it with a root-relative URL in UI components; this remains valid in both environments.