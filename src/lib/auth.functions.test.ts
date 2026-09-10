import { describe, expect, it } from "bun:test";
import { safeCompare } from "./auth.functions";

describe("safeCompare", () => {
  it("returns true for matching strings", () => {
    expect(safeCompare("secret123", "secret123")).toBe(true);
    expect(safeCompare("admin-code-xyz", "admin-code-xyz")).toBe(true);
  });

  it("returns false for non-matching strings", () => {
    expect(safeCompare("secret123", "secret124")).toBe(false);
    expect(safeCompare("secret123", "secret1234")).toBe(false);
    expect(safeCompare("wrong", "secret123")).toBe(false);
    expect(safeCompare("", "secret123")).toBe(false);
  });
});
