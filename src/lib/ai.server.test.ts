import { describe, expect, it, mock } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson error handling", () => {
  it("does not leak sensitive upstream response body in thrown error message on HTTP error", async () => {
    process.env["GROQ_API_KEY"] = "mock-key";

    const originalFetch = globalThis.fetch;
    const sensitiveBody = "SENSITIVE_INTERNAL_API_DETAILS_SECRET_TOKEN_EXPOSED";

    globalThis.fetch = mock(async () => {
      return new Response(sensitiveBody, {
        status: 500,
        statusText: "Internal Server Error",
      });
    }) as unknown as typeof fetch;

    try {
      await expect(callGatewayJson("system prompt", "user prompt")).rejects.toThrow(
        "AI 분석 실패 [500]",
      );

      try {
        await callGatewayJson("system prompt", "user prompt");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        const error = err as Error;
        expect(error.message).not.toContain(sensitiveBody);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
