## 2025-05-18 - Radix Slot Button asChild with Link and disabled state
**Learning:** Using `Button asChild disabled={...}` with a `<Link>` child renders `<a disabled ...>`, but HTML `<a>` tags ignore `disabled` attributes and `:disabled` CSS pseudo-classes. This leaves disabled-styled links operable via click and keyboard navigation.
**Action:** Conditionally render a standard `<Button disabled>` when disabled instead of delegating to `<Link asChild>` to properly lock navigation and inform assistive technology.
