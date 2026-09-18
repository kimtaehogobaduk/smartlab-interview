import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson", () => {
  const originalEnv = process.env.GROQ_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.GROQ_API_KEY = "test_key_123";
  });

  afterEach(() => {
    process.env.GROQ_API_KEY = originalEnv;
    globalThis.fetch = originalFetch;
  });

  it("throws error when GROQ_API_KEY is missing", async () => {
    delete process.env.GROQ_API_KEY;
    expect(callGatewayJson("system", "user")).rejects.toThrow(
      "GROQ_API_KEY가 설정되지 않았습니다.",
    );
  });

  it("throws sanitized error message when gateway returns 500 without leaking raw response body", async () => {
    const sensitiveBody = JSON.stringify({
      error: "Internal failure",
      api_key_used: "test_key_123",
      stack_trace: "Error at GroqServer.handleRequest (/internal/path/server.js:42)",
    });

    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(sensitiveBody, {
          status: 500,
          statusText: "Internal Server Error",
        }),
      ),
    ) as unknown as typeof fetch;

    try {
      await callGatewayJson("system prompt", "user prompt");
      throw new Error("Should have thrown error");
    } catch (err: unknown) {
      if ((err as Error).message === "Should have thrown error") {
        throw err;
      }
      const error = err as Error;
      expect(error.message).toContain("AI 분석 중 오류가 발생했습니다.");
      expect(error.message).toContain("500");
      expect(error.message).not.toContain("sensitiveBody");
      expect(error.message).not.toContain("stack_trace");
      expect(error.message).not.toContain("api_key_used");
    }
  });

  it("returns parsed JSON on success", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"result":"success"}' } }],
          }),
          { status: 200 },
        ),
      ),
    ) as unknown as typeof fetch;

    const result = await callGatewayJson("system", "user");
    expect(result).toEqual({ result: "success" });
  });
});
