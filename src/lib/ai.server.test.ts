import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { asStringArray, callGatewayJson } from "./ai.server";

describe("ai.server", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("throws error when GROQ_API_KEY is not set", async () => {
    delete process.env["GROQ_API_KEY"];
    expect(callGatewayJson("system", "user")).rejects.toThrow(
      "GROQ_API_KEY가 설정되지 않았습니다.",
    );
  });

  test("does not leak response body details on gateway error", async () => {
    process.env["GROQ_API_KEY"] = "test-key";
    const sensitiveResponseBody =
      "INTERNAL_SERVER_ERROR: stack trace with secret_token_xyz and DB connection string";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(sensitiveResponseBody, {
        status: 500,
        statusText: "Internal Server Error",
      });

    try {
      await callGatewayJson("system prompt", "user query");
      expect.unreachable("Should have thrown an error");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      const message = (err as Error).message;
      expect(message).toBe("AI 분석 실패 [500]");
      expect(message).not.toContain("secret_token_xyz");
      expect(message).not.toContain("stack trace");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("asStringArray limits and filters invalid strings", () => {
    const input = ["a", "  ", 123, null, "b", "c", "d", "e", "f"];
    const result = asStringArray(input, 3);
    expect(result).toEqual(["a", "b", "c"]);
  });
});
