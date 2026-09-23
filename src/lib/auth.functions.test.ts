import { describe, expect, it } from "bun:test";
import { AdminCodeInput, safeCompare } from "./auth.functions";

describe("safeCompare", () => {
  it("returns true for matching strings", () => {
    expect(safeCompare("secret123", "secret123")).toBe(true);
  });

  it("returns false for non-matching strings of equal length", () => {
    expect(safeCompare("secret123", "secret124")).toBe(false);
  });

  it("returns false for non-matching strings of different lengths", () => {
    expect(safeCompare("secret123", "secret")).toBe(false);
  });
});

describe("AdminCodeInput validation", () => {
  it("accepts valid admin code lengths", () => {
    expect(AdminCodeInput.parse({ code: "secret123" })).toEqual({ code: "secret123" });
  });

  it("rejects empty admin codes", () => {
    expect(() => AdminCodeInput.parse({ code: "" })).toThrow();
  });

  it("rejects overly long admin codes (DoS prevention)", () => {
    const longCode = "a".repeat(257);
    expect(() => AdminCodeInput.parse({ code: longCode })).toThrow();
  });
});
