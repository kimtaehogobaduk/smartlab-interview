import { describe, expect, it, mock } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson error handling", () => {
  it("throws error when GROQ_API_KEY is not set", async () => {
    const originalKey = process.env["GROQ_API_KEY"];
    delete process.env["GROQ_API_KEY"];
    try {
      await expect(callGatewayJson("system", "user")).rejects.toThrow(
        "GROQ_API_KEY가 설정되지 않았습니다.",
      );
    } finally {
      if (originalKey) process.env["GROQ_API_KEY"] = originalKey;
    }
  });

  it("sanitizes error messages on API error responses and does not leak response body details", async () => {
    process.env["GROQ_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    const sensitiveResponseBody =
      "Internal Server Secret Error Trace: key_id=12345 db_host=10.0.0.1";

    globalThis.fetch = mock(async () => {
      return new Response(sensitiveResponseBody, {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }) as unknown as typeof fetch;

    try {
      await expect(callGatewayJson("system", "user")).rejects.toThrow(
        "AI 분석에 실패했습니다. (상태 코드: 500)",
      );

      try {
        await callGatewayJson("system", "user");
      } catch (err) {
        const errorMessage = (err as Error).message;
        expect(errorMessage).not.toContain("Internal Server Secret Error Trace");
        expect(errorMessage).not.toContain("10.0.0.1");
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
