import { describe, expect, it } from "bun:test";
import { safeCompare } from "./auth.functions";

describe("safeCompare", () => {
  it("returns true for exact matching strings", () => {
    expect(safeCompare("secret-admin-pass-1234", "secret-admin-pass-1234")).toBe(true);
  });

  it("returns false for non-matching strings of same length", () => {
    expect(safeCompare("secret-admin-pass-1234", "secret-admin-pass-9999")).toBe(false);
  });

  it("returns false for non-matching strings of different lengths", () => {
    expect(safeCompare("short", "longer-secret-string")).toBe(false);
  });

  it("returns false when comparing against empty string", () => {
    expect(safeCompare("", "secret")).toBe(false);
    expect(safeCompare("secret", "")).toBe(false);
  });

  it("returns true for empty strings on both sides", () => {
    expect(safeCompare("", "")).toBe(true);
  });
});
