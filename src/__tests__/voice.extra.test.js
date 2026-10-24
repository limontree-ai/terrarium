// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { parseVoiceKeywords } from "../voice/speech.js";
import { parseVoiceCommand } from "../../server/voice-api.js";
import { WORLD_DEFAULTS } from "../config.js";

const COMMANDS = [
  ["make it flood", { waterLevel: 1 }],
  ["add some water", { waterLevel: 1 }],
  ["drain the island", { waterLevel: 0 }],
  ["make it snow", { snowDepth: 0.2 }],
  ["melt the snow", { snowDepth: 0 }],
  ["make it rain", { rain: 1 }],
  ["stop the rain", { rain: 0 }],
  ["make the ground muddy", { mud: 0.7 }],
  ["go to the moon", { gravity: 0.16 }],
  ["less gravity please", { gravity: 0.5 }],
  ["make everything heavier", { gravity: 1.5 }],
  ["back to normal gravity", { gravity: 1 }],
  ["add wind", { wind: { strength: 1, direction: 0 } }],
  ["calm the air", { wind: { strength: 0, direction: 0 } }],
  ["turn the ground to ice", { groundType: "ice" }],
  ["make it a desert", { groundType: "sand" }],
  ["make it night", { timeOfDay: "night" }],
  ["show me a sunset", { timeOfDay: "sunset" }],
  ["remove the trees", { treeCount: 0 }],
  ["grow a forest", { treeCount: 24 }],
  ["give him more food", { food: 8 }],
];

describe("Keyword fallback", () => {
  it.each(COMMANDS)("parses %j", (text, expected) => {
    expect(parseVoiceKeywords(text)).toEqual(expected);
  });

  it("does not read 'lightning' as low gravity", () => {
    expect(parseVoiceKeywords("lightning storm").gravity).toBeUndefined();
  });
});

function fakeClient(content) {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (body, options) => {
        calls.push({ body, options });
        if (content instanceof Error) throw content;
        return { content };
      },
    },
  };
}

const tool = (input) => ({ type: "tool_use", name: "update_world", input });

describe("parseVoiceCommand", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("falls back to keywords without an API key", async () => {
    const result = await parseVoiceCommand("make it snow", WORLD_DEFAULTS);
    expect(result).toEqual({ changes: { snowDepth: 0.2 }, reply: null, source: "keywords" });
  });

  it("falls back to keywords when Claude fails", async () => {
    const client = fakeClient(new Error("timeout"));
    const result = await parseVoiceCommand("go to the moon", WORLD_DEFAULTS, { client });
    expect(result.changes).toEqual({ gravity: 0.16 });
    expect(result.source).toBe("keywords");
  });

  it("applies set/increase/decrease with clamping and a timeout", async () => {
    const client = fakeClient([
      tool({ setting: "waterLevel", operation: "increase", value: 0.3 }),
      tool({ setting: "gravity", operation: "set", value: 5 }),
      tool({ setting: "treeCount", operation: "decrease", value: 20 }),
    ]);
    const result = await parseVoiceCommand("more water, huge gravity, fewer trees", WORLD_DEFAULTS, { client });
    expect(result.changes).toEqual({ waterLevel: 0.3, gravity: 2, treeCount: 0 });
    expect(result.source).toBe("claude");
    expect(client.calls[0].options.timeout).toBe(3000);
  });

  it("maps wind settings into the nested wind object", async () => {
    const client = fakeClient([
      tool({ setting: "windStrength", operation: "increase", value: 0.5 }),
      tool({ setting: "windDirection", operation: "set", value: 450 }),
    ]);
    const settings = { ...WORLD_DEFAULTS, wind: { strength: 0.25, direction: 10 } };
    const result = await parseVoiceCommand("windier from the east", settings, { client });
    expect(result.changes).toEqual({ wind: { strength: 0.75, direction: 90 } });
  });

  it("sets string settings from choice and ignores invalid ones", async () => {
    const client = fakeClient([
      tool({ setting: "groundType", operation: "set", choice: "ice" }),
      tool({ setting: "timeOfDay", operation: "set", choice: "midnight" }),
      { type: "tool_use", name: "reply", input: { text: "Brr." } },
    ]);
    const result = await parseVoiceCommand("ice world", WORLD_DEFAULTS, { client });
    expect(result.changes).toEqual({ groundType: "ice" });
    expect(result.reply).toBe("Brr.");
  });
});
