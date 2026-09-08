import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runWithStartContext } from "@tanstack/start-storage-context";
import { safeCompare, verifyAdminCodeHandler } from "./auth.functions";

describe("safeCompare", () => {
  test("returns true for identical strings", () => {
    expect(safeCompare("secret123", "secret123")).toBe(true);
    expect(safeCompare("", "")).toBe(true);
  });

  test("returns false for non-matching strings of same length", () => {
    expect(safeCompare("secret123", "secret124")).toBe(false);
  });

  test("returns false for non-matching strings of different lengths", () => {
    expect(safeCompare("secret123", "secret")).toBe(false);
  });
});

describe("verifyAdminCodeHandler", () => {
  const originalEnv = process.env["ADMIN_ACCESS_CODE"];

  beforeEach(() => {
    delete process.env["ADMIN_ACCESS_CODE"];
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env["ADMIN_ACCESS_CODE"] = originalEnv;
    } else {
      delete process.env["ADMIN_ACCESS_CODE"];
    }
  });

  test("throws error if ADMIN_ACCESS_CODE is not set", async () => {
    expect(
      runWithStartContext({}, () => verifyAdminCodeHandler({ data: { code: "anycode" } })),
    ).rejects.toThrow("ADMIN_ACCESS_CODE가 설정되지 않았습니다.");
  });

  test("returns valid: true when code matches ADMIN_ACCESS_CODE", async () => {
    process.env["ADMIN_ACCESS_CODE"] = "super-secret-code-123";
    const res = await runWithStartContext({}, () =>
      verifyAdminCodeHandler({ data: { code: "super-secret-code-123" } }),
    );
    expect(res).toEqual({ valid: true });
  });

  test("returns valid: false when code does not match ADMIN_ACCESS_CODE", async () => {
    process.env["ADMIN_ACCESS_CODE"] = "super-secret-code-123";
    const res = await runWithStartContext({}, () =>
      verifyAdminCodeHandler({ data: { code: "wrong-code" } }),
    );
    expect(res).toEqual({ valid: false });
  });
});
