## 2026-03-09 - Accessible Icon Buttons & Interactive Sliders

**Learning:** Icon-only buttons and range sliders in evaluation consoles often lack explicit ARIA labels and focus-visible indicators, making screen reader and keyboard navigation impossible.
**Action:** Always add descriptive `aria-label` and `aria-hidden="true"` on internal SVG icons, plus explicit `type="button"` and `focus-visible` ring utility classes on interactive card wrappers.
