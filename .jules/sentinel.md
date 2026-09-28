# Sentinel Security Journal

## 2026-03-31 - CSV Formula Injection in Export Functions

**Vulnerability:** Exporting user-influenced strings (candidate names, tracks, evaluation criterion names) directly to CSV without sanitizing formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) allowed spreadsheet formula injection (CWE-1236).
**Learning:** CSV exports built using standard string concatenation or `.join(",")` do not automatically escape formula triggers or handle cell wrapping and quote escaping.
**Prevention:** Always pass CSV cells through a sanitization function (`sanitizeCsvCell`) that prefixes formula trigger characters with a single quote (`'`) and properly escapes double quotes and delimiters (`"`, `,`, `\n`, `\r`).
