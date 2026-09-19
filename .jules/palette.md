## 2025-05-18 - Accessible Icon-Only Interactive Elements

**Learning:** Icon-only buttons and navigation links (such as header back buttons, STT note send buttons, and candidate row action buttons) lack accessible names by default when using standalone Lucide icons, making them unusable for screen reader users.
**Action:** Always provide explicit, descriptive `aria-label` attributes to any icon-only `<Button>` or `<Link>` element.
