import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// Enforce strict input validation (length limits) to mitigate Denial of Service (DoS) and memory exhaustion risks.
export const AdminCodeInput = z.object({ code: z.string().min(1).max(256) });

/**
 * Constant-time comparison using SHA-256 digests to prevent timing attack side-channels
 * when verifying sensitive authorization credentials.
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
    // Prevent timing attacks when comparing admin access code
    return { valid: safeCompare(data.code, expected) };
  });
