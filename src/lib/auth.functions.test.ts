import { describe, expect, it } from "bun:test";
import { safeCompare } from "./auth.functions";

describe("safeCompare", () => {
  it("returns true for matching strings", () => {
    expect(safeCompare("secret123", "secret123")).toBe(true);
    expect(safeCompare("admin-pass", "admin-pass")).toBe(true);
  });

  it("returns false for non-matching strings of same length", () => {
    expect(safeCompare("secret123", "secret124")).toBe(false);
    expect(safeCompare("admin-pass", "bdmin-pass")).toBe(false);
  });

  it("returns false for strings of different length", () => {
    expect(safeCompare("secret", "secret123")).toBe(false);
    expect(safeCompare("secret123456", "secret123")).toBe(false);
    expect(safeCompare("a", "b")).toBe(false);
  });
});
