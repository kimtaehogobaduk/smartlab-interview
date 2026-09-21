import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson", () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env["GROQ_API_KEY"];

  beforeEach(() => {
    process.env["GROQ_API_KEY"] = "test-key";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey !== undefined) {
      process.env["GROQ_API_KEY"] = originalApiKey;
    } else {
      delete process.env["GROQ_API_KEY"];
    }
  });

  it("throws error if GROQ_API_KEY is missing", async () => {
    delete process.env["GROQ_API_KEY"];
    expect(callGatewayJson("system", "user")).rejects.toThrow(
      "GROQ_API_KEY가 설정되지 않았습니다.",
    );
  });

  it("sanitizes unexpected API error response bodies without leaking sensitive data", async () => {
    const sensitiveBody = '{"error": {"message": "Secret token invalid: xyz123"}}';
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(sensitiveBody, {
          status: 500,
          statusText: "Internal Server Error",
        }),
      ),
    ) as unknown as typeof fetch;

    await expect(callGatewayJson("system", "user")).rejects.toThrow(
      "AI 분석 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
