import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson", () => {
  const originalEnv = process.env;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv, GROQ_API_KEY: "test-api-key" };
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  it("throws error if GROQ_API_KEY is not configured", async () => {
    delete process.env["GROQ_API_KEY"];
    expect(callGatewayJson("system", "user")).rejects.toThrow(
      "GROQ_API_KEY가 설정되지 않았습니다.",
    );
  });

  it("sanitizes 500 error response without leaking response body", async () => {
    const sensitiveResponseBody = "Internal Server Error: secret_internal_db_string_12345";
    spyOn(console, "error").mockImplementation(() => {});

    globalThis.fetch = (async () =>
      new Response(sensitiveResponseBody, {
        status: 500,
        statusText: "Internal Server Error",
      })) as typeof globalThis.fetch;

    try {
      await callGatewayJson("system prompt", "user prompt");
      expect().fail("Expected callGatewayJson to throw");
    } catch (err) {
      const error = err as Error;
      expect(error.message).toBe("AI 분석 실패 [500]");
      expect(error.message).not.toContain("secret_internal_db_string_12345");
    }
  });

  it("handles rate limit 429 response", async () => {
    spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = (async () =>
      new Response("Rate limit exceeded", {
        status: 429,
      })) as typeof globalThis.fetch;

    expect(callGatewayJson("system prompt", "user prompt")).rejects.toThrow(
      "AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
