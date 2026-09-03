## 2026-03-30 - Accessible Range Sliders in Evaluation Scorecards

**Learning:** Range inputs (`<input type="range">`) in evaluation scorecards lack explicit visual labels or aria associations, leaving screen reader users without context on what criterion is being scored or what the current numerical value is.
**Action:** Always provide explicit `aria-label` (including criterion name) and `aria-valuetext` (with units, e.g. "85점") on range sliders, along with visible keyboard focus styles (`focus-visible:ring-2`).
