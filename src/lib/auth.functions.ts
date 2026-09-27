import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const AdminCodeInput = z.object({ code: z.string().min(1) });

export function safeCompare(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export async function checkAdminCode(code: string): Promise<{ valid: boolean }> {
  const expected = process.env["ADMIN_ACCESS_CODE"];
  // Fail secure: If access code is unconfigured or empty, deny authentication without leaking configuration details
  if (!expected || expected.trim() === "") {
    return { valid: false };
  }
  // Prevent timing attacks when comparing admin access code
  return { valid: safeCompare(code, expected) };
}

export const verifyAdminCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AdminCodeInput.parse(data))
  .handler(async ({ data }) => {
    return checkAdminCode(data.code);
  });
