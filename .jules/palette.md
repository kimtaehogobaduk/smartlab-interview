## 2026-03-30 - Accessible Names for Icon-Only Navigation & Table Actions
**Learning:** Icon-only buttons and links in header shells, data tables, and interactive consoles (`<ArrowLeft />`, `<X />`, `<Send />`) lack accessible names unless `aria-label` is explicitly provided, making them ambiguous to screen reader users and keyboard navigators.
**Action:** Always verify icon-only `<Button>` and `<Link>` elements have `aria-label` and visible focus state rings (`focus-visible:ring-2 focus-visible:ring-ring`).
