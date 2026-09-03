import { createHash, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AdminCodeInput = z.object({ code: z.string().min(1) });

export function checkAdminCode(inputCode: string, expectedCode?: string): boolean {
  if (!expectedCode) throw new Error("ADMIN_ACCESS_CODE가 설정되지 않았습니다.");
  const expectedHash = createHash("sha256").update(expectedCode).digest();
  const inputHash = createHash("sha256").update(inputCode).digest();
  return timingSafeEqual(expectedHash, inputHash);
}

export const verifyAdminCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AdminCodeInput.parse(data))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_ACCESS_CODE"];
    return { valid: checkAdminCode(data.code, expected) };
  });
