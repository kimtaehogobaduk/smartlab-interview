import { describe, expect, it } from "bun:test";
import { safeCompare } from "./auth.functions";

describe("safeCompare", () => {
  it("returns true for matching strings", async () => {
    expect(await safeCompare("secret123", "secret123")).toBe(true);
  });

  it("returns false for non-matching strings of equal length", async () => {
    expect(await safeCompare("secret123", "secret124")).toBe(false);
  });

  it("returns false for non-matching strings of different lengths", async () => {
    expect(await safeCompare("secret123", "secret")).toBe(false);
  });
});
