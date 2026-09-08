import { timingSafeEqual, createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AdminCodeInput = z.object({ code: z.string().min(1) });

/**
 * Constant-time comparison to prevent timing side-channel attacks when verifying secret codes.
 * Standard string equality (`==` or `===`) exits early on the first byte mismatch,
 * allowing an attacker to deduce the access code character by character based on response timing.
 *
 * Hashing inputs to fixed 256-bit digests before `timingSafeEqual` ensures constant-time execution
 * regardless of length or content.
 */
export function safeCompare(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export const verifyAdminCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AdminCodeInput.parse(data))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_ACCESS_CODE"];
    if (!expected) throw new Error("ADMIN_ACCESS_CODE가 설정되지 않았습니다.");
    return { valid: safeCompare(data.code, expected) };
  });
