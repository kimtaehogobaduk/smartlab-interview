## 2026-09-05 - Icon-only Buttons Missing Descriptive ARIA Labels
**Learning:** Icon-only navigation links (e.g. `<Link>` containing `<ArrowLeft />`) and action buttons (e.g. `<Button>` containing `<X />` or `<Send />`) lack implicit text nodes and must have explicit `aria-label` attributes to ensure screen readers announce their function.
**Action:** Always provide explicit, localized `aria-label` attributes for icon-only `<Button>` and `<Link>` components across the application.
