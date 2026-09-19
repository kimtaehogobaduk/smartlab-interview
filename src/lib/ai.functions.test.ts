import { describe, expect, it } from "bun:test";
import { z } from "zod";

const ParserInput = z.object({
  rawInput: z.string().max(50000).default(""),
  imageBase64: z.string().max(10000000).optional(),
});

const FeedbackInput = z.object({
  transcript: z.string().min(1).max(50000),
  candidateProfile: z.string().max(10000).default(""),
  documents: z.string().max(50000).default(""),
});

const MindMapInput = z.object({
  candidateName: z.string().max(200).default(""),
  documents: z.string().min(1).max(50000),
});

describe("AI Function Input Validation Schemas", () => {
  describe("ParserInput", () => {
    it("accepts valid rawInput and imageBase64", () => {
      const valid = { rawInput: "Hello", imageBase64: "data:image/png;base64,abc" };
      expect(() => ParserInput.parse(valid)).not.toThrow();
    });

    it("rejects rawInput exceeding length limit", () => {
      const invalid = { rawInput: "a".repeat(50001) };
      expect(() => ParserInput.parse(invalid)).toThrow();
    });

    it("rejects imageBase64 exceeding length limit", () => {
      const invalid = { imageBase64: "a".repeat(10000001) };
      expect(() => ParserInput.parse(invalid)).toThrow();
    });
  });

  describe("FeedbackInput", () => {
    it("accepts valid feedback inputs", () => {
      const valid = {
        transcript: "Interview transcript",
        candidateProfile: "Profile",
        documents: "Docs",
      };
      expect(() => FeedbackInput.parse(valid)).not.toThrow();
    });

    it("rejects empty transcript", () => {
      const invalid = { transcript: "" };
      expect(() => FeedbackInput.parse(invalid)).toThrow();
    });

    it("rejects transcript exceeding length limit", () => {
      const invalid = { transcript: "a".repeat(50001) };
      expect(() => FeedbackInput.parse(invalid)).toThrow();
    });

    it("rejects candidateProfile exceeding length limit", () => {
      const invalid = { transcript: "valid", candidateProfile: "a".repeat(10001) };
      expect(() => FeedbackInput.parse(invalid)).toThrow();
    });
  });

  describe("MindMapInput", () => {
    it("accepts valid mind map inputs", () => {
      const valid = { candidateName: "John Doe", documents: "Resume content" };
      expect(() => MindMapInput.parse(valid)).not.toThrow();
    });

    it("rejects candidateName exceeding length limit", () => {
      const invalid = { candidateName: "a".repeat(201), documents: "Resume" };
      expect(() => MindMapInput.parse(invalid)).toThrow();
    });

    it("rejects documents exceeding length limit", () => {
      const invalid = { documents: "a".repeat(50001) };
      expect(() => MindMapInput.parse(invalid)).toThrow();
    });
  });
});
