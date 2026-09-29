import { describe, expect, it } from "bun:test";
import { safeCompare, verifyAdminCodeHandler } from "./auth.functions";

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

describe("verifyAdminCodeHandler", () => {
  it("returns true when code matches expected ADMIN_ACCESS_CODE", async () => {
    expect(await verifyAdminCodeHandler("admin_secret", "admin_secret")).toBe(true);
  });

  it("returns false when code does not match expected ADMIN_ACCESS_CODE", async () => {
    expect(await verifyAdminCodeHandler("wrong_secret", "admin_secret")).toBe(false);
  });

  it("fails securely without throwing when ADMIN_ACCESS_CODE is not configured", async () => {
    expect(await verifyAdminCodeHandler("any_code", undefined)).toBe(false);
  });
});
