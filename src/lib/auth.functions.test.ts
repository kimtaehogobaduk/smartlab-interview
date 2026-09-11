import { describe, expect, it } from "bun:test";
import { safeCompare } from "./auth.functions";

describe("auth.functions - safeCompare", () => {
  it("returns true for matching strings", () => {
    expect(safeCompare("admin123", "admin123")).toBe(true);
  });

  it("returns false for non-matching strings of same length", () => {
    expect(safeCompare("admin123", "admin124")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(safeCompare("admin", "admin123")).toBe(false);
  });

  it("returns false for empty vs non-empty strings", () => {
    expect(safeCompare("", "secret")).toBe(false);
  });
});
