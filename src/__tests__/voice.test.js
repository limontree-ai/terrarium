import { describe, it, expect } from "vitest";
import { parseVoiceKeywords } from "../voice/speech.js";

describe("Voice", () => {
  it("parses water command", () => {
    const changes = parseVoiceKeywords("make it flood");
    expect(changes.waterLevel).toBe(1);
  });

  it("parses snow command", () => {
    const changes = parseVoiceKeywords("add snow");
    expect(changes.snowDepth).toBeGreaterThan(0);
  });

  it("parses gravity command", () => {
    const changes = parseVoiceKeywords("go to the moon");
    expect(changes.gravity).toBeCloseTo(0.16, 1);
  });
});
