## 2025-05-20 - Icon-Only Action Buttons in Data Tables

**Learning:** Icon-only action buttons inside repeating table rows (such as delete or remove actions) lack context when read by screen readers unless uniquely labelled with the row item's context (e.g. candidate name).
**Action:** Always supply `aria-label={`${item.name} [Action]``} for icon-only action buttons in data lists or tables.
