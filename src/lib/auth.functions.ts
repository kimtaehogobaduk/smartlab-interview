import { createServerFn } from "@tanstack/react-start";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

const AdminCodeInput = z.object({ code: z.string().min(1) });

/**
 * Compares two strings in constant time to prevent timing side-channel attacks.
 */
export function checkAdminCode(code: string, expected: string): boolean {
  const inputBuf = Buffer.from(code);
  const expectedBuf = Buffer.from(expected);

  // timingSafeEqual requires buffers of identical length
  return inputBuf.length === expectedBuf.length && timingSafeEqual(inputBuf, expectedBuf);
}

export const verifyAdminCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AdminCodeInput.parse(data))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_ACCESS_CODE"];
    if (!expected) throw new Error("ADMIN_ACCESS_CODE가 설정되지 않았습니다.");

    return { valid: checkAdminCode(data.code, expected) };
  });
