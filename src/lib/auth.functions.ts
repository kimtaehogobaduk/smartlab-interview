import { createServerFn } from "@tanstack/react-start";
import { timingSafeEqual, createHash } from "node:crypto";
import { z } from "zod";

const AdminCodeInput = z.object({ code: z.string().min(1) });

/**
 * Hash input string to fixed length buffer before timingSafeEqual comparison.
 * Hashing ensures constant length buffers regardless of input string length.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = createHash("sha256").update(a).digest();
  const bufB = createHash("sha256").update(b).digest();
  return timingSafeEqual(bufA, bufB);
}

export const verifyAdminCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AdminCodeInput.parse(data))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_ACCESS_CODE"];
    if (!expected) throw new Error("ADMIN_ACCESS_CODE가 설정되지 않았습니다.");

    // SECURITY: Use timing-safe constant time comparison to prevent timing side-channel attacks
    return { valid: safeCompare(data.code, expected) };
  });
