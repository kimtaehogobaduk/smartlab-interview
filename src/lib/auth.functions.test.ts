import { describe, expect, it } from "bun:test";
import { timingSafeStringCompare } from "./auth.functions";

describe("timingSafeStringCompare", () => {
  it("returns true for matching strings", () => {
    expect(timingSafeStringCompare("secret-code-123", "secret-code-123")).toBe(true);
    expect(timingSafeStringCompare("admin", "admin")).toBe(true);
  });

  it("returns false for non-matching strings of the same length", () => {
    expect(timingSafeStringCompare("secret-code-123", "secret-code-124")).toBe(false);
    expect(timingSafeStringCompare("admin1", "admin2")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(timingSafeStringCompare("secret", "secret-123")).toBe(false);
    expect(timingSafeStringCompare("admin", "adm")).toBe(false);
    expect(timingSafeStringCompare("", "a")).toBe(false);
  });
});
