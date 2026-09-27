import { afterEach, describe, expect, it } from "bun:test";
import { checkAdminCode, safeCompare } from "./auth.functions";

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

describe("checkAdminCode", () => {
  const originalEnv = process.env["ADMIN_ACCESS_CODE"];

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env["ADMIN_ACCESS_CODE"] = originalEnv;
    } else {
      delete process.env["ADMIN_ACCESS_CODE"];
    }
  });

  it("returns valid: false when ADMIN_ACCESS_CODE is not set", async () => {
    delete process.env["ADMIN_ACCESS_CODE"];
    const res = await checkAdminCode("anycode");
    expect(res).toEqual({ valid: false });
  });

  it("returns valid: false when ADMIN_ACCESS_CODE is empty string", async () => {
    process.env["ADMIN_ACCESS_CODE"] = "   ";
    const res = await checkAdminCode("anycode");
    expect(res).toEqual({ valid: false });
  });

  it("returns valid: true for matching access code", async () => {
    process.env["ADMIN_ACCESS_CODE"] = "supersecret";
    const res = await checkAdminCode("supersecret");
    expect(res).toEqual({ valid: true });
  });

  it("returns valid: false for incorrect access code", async () => {
    process.env["ADMIN_ACCESS_CODE"] = "supersecret";
    const res = await checkAdminCode("wrongcode");
    expect(res).toEqual({ valid: false });
  });
});
