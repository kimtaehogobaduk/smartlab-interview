import { describe, expect, it, mock } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson error handling", () => {
  it("does not leak raw upstream response body in error message when gateway returns 500", async () => {
    process.env["GROQ_API_KEY"] = "fake-key";
    const sensitiveBody = "Internal error at 10.0.0.12: secret_backend_info";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(sensitiveBody, { status: 500 });
    }) as unknown as typeof fetch;

    try {
      await expect(callGatewayJson("system", "user")).rejects.toThrow(
        "AI 분석을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
