## 2025-05-18 - Icon-only Buttons & Range Inputs Accessibility

**Learning:** Icon-only navigation buttons and range sliders in interview consoles lack default text alternatives, leaving screen reader users without context for key interactive controls.
**Action:** Always provide explicit `aria-label` attributes on icon-only buttons (`AppShell` back navigation, delete buttons, send buttons) and range sliders (`input[type="range"]`) across evaluation views.
