## 2026-09-28 - Radix UI Button asChild with Link Disabled Navigation

**Learning:** Radix UI `Button asChild` passing `disabled` to a TanStack Router `<Link>` element does not prevent standard HTML `<a>` navigation.
**Action:** Conditionally render a standard `<Button disabled>` when disabled, instead of wrapping `<Link>` with `<Button asChild disabled>`.
