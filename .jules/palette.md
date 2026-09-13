## 2026-03-13 - Icon-only Buttons Missing Accessibility Labels

**Learning:** Icon-only buttons (such as trash/delete buttons or send message buttons) lack default text for screen readers, leading to poor accessibility for non-visual navigation in custom tables and consoles.
**Action:** Always provide descriptive `aria-label` attributes to icon-only buttons, incorporating contextual names where applicable (e.g., candidate name or specific action).
