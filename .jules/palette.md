# Palette's Journal - Critical UX & Accessibility Learnings

## 2026-03-31 - Icon-Only Action Buttons in Admin & Interview Room

**Learning:** Icon-only buttons without explicit `aria-label`s or visually hidden text are invisible to screen reader users and fail accessibility standards.
**Action:** Always provide an explicit `aria-label` describing the specific action and context (e.g. candidate name or target item) for all icon-only buttons and icon-only navigation links across components.
