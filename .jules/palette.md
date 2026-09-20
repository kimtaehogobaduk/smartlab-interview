## 2026-03-31 - Icon-Only Navigation & Action Accessibility Pattern
**Learning:** Icon-only navigation links (such as the header back link) and action buttons (such as candidate delete or send note buttons) must always include explicit `aria-label`s and `focus-visible` ring indicators to ensure screen reader readability and keyboard navigation focus states.
**Action:** When adding or auditing icon-only buttons in the component library or routes, verify that `aria-label` provides clear contextual text and that `focus-visible:ring-2` focus indicators are present.
