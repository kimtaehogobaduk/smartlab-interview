# Palette's Journal - Critical UX Learnings

## 2025-05-18 - AppShell Navigation Accessibility

**Learning:** Icon-only navigation links in header shells require explicit `aria-label` attributes to ensure screen readers provide meaningful context for back navigation.
**Action:** Always add an `aria-label` (e.g. `aria-label="뒤로 가기"`) to icon-only back links across all shell and template components.
