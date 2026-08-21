import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AdminCodeInput = z.object({ code: z.string().min(1) });

export const verifyAdminCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AdminCodeInput.parse(data))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_ACCESS_CODE"];
    if (!expected) throw new Error("ADMIN_ACCESS_CODE가 설정되지 않았습니다.");
    return { valid: data.code === expected };
  });
