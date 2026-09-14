import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson", () => {
  const originalEnv = process.env.GROQ_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-api-key";
  });

  afterEach(() => {
    process.env.GROQ_API_KEY = originalEnv;
    globalThis.fetch = originalFetch;
  });

  it("throws sanitized error without leaking internal body when gateway fails with 500", async () => {
    const sensitiveBody = "Internal server error details: SECRET_DB_CONNECTION_STRING";
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(sensitiveBody, {
          status: 500,
          statusText: "Internal Server Error",
        }),
      ),
    ) as typeof fetch;

    try {
      await callGatewayJson("system prompt", "user prompt");
      expect().fail("Expected callGatewayJson to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      const message = (err as Error).message;
      expect(message).toBe("AI 분석에 실패했습니다. (상태 코드: 500)");
      expect(message).not.toContain("SECRET_DB_CONNECTION_STRING");
    }
  });

  it("throws specific rate limit message on 429", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response("Rate limit exceeded", { status: 429, statusText: "Too Many Requests" }),
      ),
    ) as typeof fetch;

    expect(callGatewayJson("sys", "user")).rejects.toThrow("AI 요청이 많습니다.");
  });
});
