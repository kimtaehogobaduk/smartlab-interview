## 2025-05-10 - Accessible ARIA Labels for Icon-Only Navigation & Action Buttons

**Learning:** Icon-only buttons (such as Lucide `<ArrowLeft />`, `<X />`, and `<Send />`) without inner text are unannounced or announced as unlabeled buttons by screen readers. Adding explicit, localized `aria-label` attributes ensures screen reader accessibility across candidate and navigation flows.
**Action:** Always include a descriptive `aria-label` attribute when using `size="icon"` or icon-only `<button>` and `<Link>` components.
