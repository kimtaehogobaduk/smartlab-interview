import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson", () => {
  const originalEnv = process.env["GROQ_API_KEY"];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env["GROQ_API_KEY"] = "dummy-api-key";
  });

  afterEach(() => {
    process.env["GROQ_API_KEY"] = originalEnv;
    globalThis.fetch = originalFetch;
  });

  it("throws error if GROQ_API_KEY is missing", async () => {
    delete process.env["GROQ_API_KEY"];
    await expect(callGatewayJson("system", "user")).rejects.toThrow(
      "GROQ_API_KEY가 설정되지 않았습니다.",
    );
  });

  it("sanitizes 500 error response without leaking sensitive body text", async () => {
    const sensitiveBody = "Internal Server Error: Secret Key leaked or stack trace details";
    globalThis.fetch = mock(async () => {
      return new Response(sensitiveBody, { status: 500 });
    }) as unknown as typeof fetch;

    try {
      await callGatewayJson("system", "user input");
      expect().fail("Expected callGatewayJson to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      const errorMsg = (err as Error).message;
      expect(errorMsg).toBe("AI 분석 중 오류가 발생했습니다 (500).");
      expect(errorMsg).not.toContain(sensitiveBody);
      expect(errorMsg).not.toContain("Secret Key");
    }
  });

  it("handles 429 rate limit error gracefully", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Too Many Requests", { status: 429 });
    }) as unknown as typeof fetch;

    await expect(callGatewayJson("system", "user input")).rejects.toThrow(
      "AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
