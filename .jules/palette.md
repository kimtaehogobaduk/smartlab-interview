## 2025-05-18 - Icon-Only Interactive Elements Accessibility

**Learning:** Icon-only navigation links (e.g., AppShell back button) and action buttons (e.g., CandidateTable delete button and STT note send button) lacked `aria-label` attributes, creating silent screen reader barriers despite other form components in the codebase including them.
**Action:** Always audit icon-only `<Button size="icon">` and `<Link>` components to ensure descriptive `aria-label` or visually hidden text is attached.
