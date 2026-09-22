import { describe, expect, test } from "bun:test";
import { FeedbackInput, MindMapInput, ParserInput } from "./ai.functions";

describe("AI Server Functions Input Validation", () => {
  describe("ParserInput", () => {
    test("accepts valid input", () => {
      const input = { rawInput: "some raw text" };
      expect(ParserInput.parse(input)).toEqual({
        rawInput: "some raw text",
      });
    });

    test("rejects rawInput exceeding length limit", () => {
      const input = { rawInput: "a".repeat(50001) };
      expect(() => ParserInput.parse(input)).toThrow();
    });

    test("rejects imageBase64 exceeding length limit", () => {
      const input = { imageBase64: "a".repeat(10000001) };
      expect(() => ParserInput.parse(input)).toThrow();
    });
  });

  describe("FeedbackInput", () => {
    test("accepts valid input", () => {
      const input = {
        transcript: "Interviewer: Hello",
        candidateProfile: "Profile info",
        documents: "Document info",
      };
      expect(FeedbackInput.parse(input)).toEqual(input);
    });

    test("rejects transcript exceeding length limit", () => {
      const input = { transcript: "a".repeat(50001) };
      expect(() => FeedbackInput.parse(input)).toThrow();
    });

    test("rejects candidateProfile exceeding length limit", () => {
      const input = {
        transcript: "Valid transcript",
        candidateProfile: "a".repeat(20001),
      };
      expect(() => FeedbackInput.parse(input)).toThrow();
    });

    test("rejects documents exceeding length limit", () => {
      const input = {
        transcript: "Valid transcript",
        documents: "a".repeat(50001),
      };
      expect(() => FeedbackInput.parse(input)).toThrow();
    });
  });

  describe("MindMapInput", () => {
    test("accepts valid input", () => {
      const input = {
        candidateName: "John Doe",
        documents: "Candidate resume content",
      };
      expect(MindMapInput.parse(input)).toEqual(input);
    });

    test("rejects candidateName exceeding length limit", () => {
      const input = {
        candidateName: "a".repeat(201),
        documents: "Valid document",
      };
      expect(() => MindMapInput.parse(input)).toThrow();
    });

    test("rejects documents exceeding length limit", () => {
      const input = {
        documents: "a".repeat(50001),
      };
      expect(() => MindMapInput.parse(input)).toThrow();
    });
  });
});
