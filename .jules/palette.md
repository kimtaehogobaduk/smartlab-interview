## 2026-03-31 - Icon-only Buttons Require Explicit ARIA Labels

**Learning:** Navigation and action controls rendered as icon-only buttons (e.g. back arrow links, delete icon buttons, send note buttons) are silent or ambiguous for assistive technology users unless an `aria-label` matching the visual context is provided.
**Action:** Always inspect icon-only `<Button>` and `<Link>` elements during UX audits and supply descriptive, localized `aria-label` attributes.
