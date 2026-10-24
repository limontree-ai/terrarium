import { Anthropic } from "@anthropic-ai/sdk";
import { parseVoiceKeywords } from "../src/voice/speech.js";
import { VOICE, WORLD_DEFAULTS, WORLD_RANGES, WORLD_CHOICES, BIOMES } from "../src/config.js";

const DEFAULT_MODEL = "claude-haiku-4-5";

const NUMERIC_RANGES = WORLD_RANGES;
const CHOICES = WORLD_CHOICES;

const TOOLS = [
  {
    name: "update_world",
    description: "Update a world setting (gravity, water level, wind, etc.)",
    input_schema: {
      type: "object",
      properties: {
        setting: {
          type: "string",
          enum: [...Object.keys(NUMERIC_RANGES), "windDirection", ...Object.keys(CHOICES)],
          description: "Which setting to change",
        },
        operation: {
          type: "string",
          enum: ["set", "increase", "decrease"],
          description: "Set to value, or increase/decrease by value",
        },
        value: {
          type: "number",
          description: "New value or delta, for numeric settings",
        },
        choice: {
          type: "string",
          enum: [...new Set(Object.values(CHOICES).flat())],
          description: "New value for groundType or timeOfDay (operation 'set')",
        },
      },
      required: ["setting", "operation"],
    },
  },
  {
    name: "set_biome",
    description: "Turn the whole world into a biome in one step (forest, jungle, ocean, desert, arctic, swamp, meadow). Use for 'make it foresty', 'turn it into an ocean'.",
    input_schema: {
      type: "object",
      properties: { biome: { type: "string", enum: Object.keys(BIOMES) } },
      required: ["biome"],
    },
  },
  {
    name: "reply",
    description: "Send a short text reply to the user (e.g., if they ask something creative)",
    input_schema: {
      type: "object",
      properties: { text: { type: "string", description: "Reply text" } },
      required: ["text"],
    },
  },
];

const SYSTEM_PROMPT = `You are the voice assistant for an evolution simulator: a purple jelly creature learns to move on a small island.
Users speak commands like "make it snow", "add water", "less gravity", "make him have wings".

Call update_world once per setting that should change. Ranges:
- waterLevel 0-1 (0 dry, 1 flooded), snowDepth 0-0.3 meters, mud 0-1, rain 0-1
- windStrength 0-1, windDirection 0-360 degrees
- gravity 0.16-2.0 (1 is Earth, 0.16 is the Moon)
- treeCount 0-100, food 1-10
- groundType: grass, sand, ice, mud, moondust (use choice)
- timeOfDay: day, sunset, night (use choice)
- treeKind: round, pine, palm (use choice)
Biomes: for "foresty", "oceany", "make it a desert" and similar, call set_biome once, then update_world for any extra tweaks.
For vague amounts ("more water", "less gravity"), use increase/decrease with a moderate delta.
The creature's body evolves on its own; if the user asks for body changes ("give him wings"), call reply() to say evolution decides, and change the world if that helps.
If you can't parse the command, call reply() explaining what you heard. Be concise.`;

let cachedClient = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  cachedClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return cachedClient;
}

/**
 * Parse voice command using Claude Haiku, falling back to keywords without a key
 * or on error/timeout. Returns { changes (WorldSettings shape), reply, source }.
 */
export async function parseVoiceCommand(text, currentSettings = {}, { client } = {}) {
  const current = { ...WORLD_DEFAULTS, ...currentSettings };
  const anthropic = client ?? getClient();
  if (!anthropic) {
    return { changes: parseVoiceKeywords(text), reply: null, source: "keywords" };
  }

  try {
    const response = await anthropic.messages.create(
      {
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        tool_choice: { type: "any" },
        messages: [{ role: "user", content: text }],
      },
      { timeout: VOICE.TIMEOUT_MS, maxRetries: 0 }
    );

    const flat = {};
    let reply = null;

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      if (block.name === "set_biome") {
        Object.assign(flat, BIOMES[block.input.biome] ?? {});
      } else if (block.name === "update_world") {
        applyChange(flat, block.input, current);
      } else if (block.name === "reply") {
        reply = block.input.text;
      }
    }

    return { changes: toSettingsShape(flat, current), reply, source: "claude" };
  } catch (err) {
    console.error("[Voice] Claude error:", err.message);
    return { changes: parseVoiceKeywords(text), reply: null, source: "keywords" };
  }
}

function currentValue(current, setting) {
  if (setting === "windStrength") return current.wind?.strength ?? 0;
  if (setting === "windDirection") return current.wind?.direction ?? 0;
  return current[setting] ?? 0;
}

/**
 * Apply one update_world call to a flat change set.
 */
function applyChange(changes, { setting, operation, value, choice }, current) {
  if (CHOICES[setting]) {
    const pick = choice ?? value;
    if (operation === "set" && CHOICES[setting].includes(pick)) changes[setting] = pick;
    return;
  }

  if (!Number.isFinite(value)) return;
  const base = setting in changes ? changes[setting] : currentValue(current, setting);

  let next;
  if (operation === "set") next = value;
  else if (operation === "increase") next = base + value;
  else if (operation === "decrease") next = base - value;
  else return;

  changes[setting] = clampValue(setting, next);
}

/**
 * Clamp values to valid ranges.
 */
function clampValue(setting, value) {
  if (setting === "windDirection") return ((value % 360) + 360) % 360;
  if (setting === "treeCount") value = Math.round(value);

  const range = NUMERIC_RANGES[setting];
  if (!range) return value;
  return Math.max(range[0], Math.min(range[1], value));
}

// windStrength/windDirection → nested wind, as in WorldSettings
function toSettingsShape(flat, current) {
  const { windStrength, windDirection, ...changes } = flat;
  if (windStrength !== undefined || windDirection !== undefined) {
    changes.wind = {
      strength: windStrength ?? current.wind?.strength ?? 0,
      direction: windDirection ?? current.wind?.direction ?? 0,
    };
  }
  return changes;
}
