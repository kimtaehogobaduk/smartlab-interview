## 2025-05-18 - Accessibility on Icon-Only Interactive Controls

**Learning:** Icon-only buttons and links (such as back navigation arrows, row deletion trash icons, or send action buttons) lack accessible names by default, rendering them unusable for screen readers.
**Action:** Always provide descriptive `aria-label` properties on icon-only `<button>` and `<Link>` elements, using contextual variables (e.g. candidate name or item name) when available.
