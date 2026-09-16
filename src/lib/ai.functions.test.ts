import { describe, expect, test } from "bun:test";
import { isValidImageUrl } from "./ai.functions";

describe("isValidImageUrl", () => {
  test("allows empty or undefined string", () => {
    expect(isValidImageUrl("")).toBe(true);
  });

  test("allows valid data:image/ URIs", () => {
    expect(
      isValidImageUrl(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      ),
    ).toBe(true);
    expect(isValidImageUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(true);
  });

  test("allows https:// URLs", () => {
    expect(isValidImageUrl("https://example.com/image.png")).toBe(true);
  });

  test("rejects non-https URLs (http, file, gopher, etc.)", () => {
    expect(isValidImageUrl("http://example.com/image.png")).toBe(false);
    expect(isValidImageUrl("file:///etc/passwd")).toBe(false);
    expect(isValidImageUrl("gopher://example.com")).toBe(false);
  });

  test("rejects malformed strings", () => {
    expect(isValidImageUrl("not a url")).toBe(false);
    expect(isValidImageUrl("javascript:alert(1)")).toBe(false);
  });
});
