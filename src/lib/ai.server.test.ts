import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson error handling & sanitization", () => {
  const originalEnv = process.env.GROQ_API_KEY;
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-key";
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.GROQ_API_KEY = originalEnv;
    consoleErrorSpy.mockRestore();
  });

  it("throws generic error message without leaking upstream response body on general error", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal Server Error with sensitive stack trace or secret: sk_live_secret", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    );

    try {
      await expect(callGatewayJson("system prompt", "user prompt")).rejects.toThrow(
        "AI 분석 처리 중 오류가 발생했습니다.",
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      mockFetch.mockRestore();
    }
  });

  it("handles 429 rate limit error gracefully without raw body exposure", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Rate limit exceeded sensitive body", {
        status: 429,
        statusText: "Too Many Requests",
      }),
    );

    try {
      await expect(callGatewayJson("system prompt", "user prompt")).rejects.toThrow(
        "AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      mockFetch.mockRestore();
    }
  });
});
