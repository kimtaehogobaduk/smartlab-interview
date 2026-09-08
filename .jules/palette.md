# Palette's Journal - Critical UX & Accessibility Learnings

## 2025-05-18 - Range Sliders and Accessible Forms

**Learning:** Evaluation criteria range sliders and custom numerical inputs require clear ARIA value descriptions (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-describedby`) so screen reader users understand the weight, current score, and bonus limitations.
**Action:** Link criterion descriptions and bonus maximums directly to inputs using `aria-describedby` and explicit ARIA labels.
