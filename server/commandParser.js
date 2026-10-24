// Turns a spoken command ("make it snow", "less gravity") into new world settings via Claude Haiku.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { RANGES, WEATHER, TIME_OF_DAY, clampSettings } from '../shared/worldSettings.js';

const client = new Anthropic();

const SettingsSchema = z.object({
  gravity: z.number(),
  weather: z.enum(WEATHER),
  timeOfDay: z.enum(TIME_OF_DAY),
  temperature: z.number(),
  treeDensity: z.number(),
  foodAbundance: z.number(),
  waterLevel: z.number(),
  windStrength: z.number(),
  terrainRoughness: z.number(),
});

const CommandResultSchema = z.object({
  understood: z.boolean(),
  settings: SettingsSchema,
  narration: z.string(),
});

const rangeLines = Object.entries(RANGES)
  .map(([key, r]) => `- ${key}: ${r.min} to ${r.max}${r.unit ? ` ${r.unit}` : ''}${r.note ? ` (${r.note})` : ''}`)
  .join('\n');

const SYSTEM_PROMPT = `You control the environment of Terrarium, a 3D island where jelly-blob creatures evolve through natural selection. Visitors speak commands to reshape the world, and you translate each command into updated world settings.

Settings and their allowed ranges:
${rangeLines}
- weather: one of ${WEATHER.join(', ')}
- timeOfDay: one of ${TIME_OF_DAY.join(', ')}

Return the complete settings object. Change only what the command asks for, plus anything that naturally follows (snow implies a temperature below freezing; "flood the island" raises waterLevel). Relative commands like "less gravity" or "more trees" should make a noticeable change of roughly 30–50% of the current value, not a tiny nudge. Keep every value inside its range.

Speech-to-text transcripts are often garbled; interpret them generously. If a command has nothing to do with the world, set understood to false and return the current settings unchanged.

narration is one short, playful sentence shown to the visitor describing what changed, for example "Snowflakes drift over the island as the temperature drops."`;

export async function interpretCommand(transcript, currentSettings) {
  const current = clampSettings(currentSettings);
  const response = await client.messages.parse({
    model: 'claude-haiku-5-5',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Current settings:\n${JSON.stringify(current, null, 2)}\n\nVoice command: ${JSON.stringify(transcript)}`,
      },
    ],
    output_config: { effort: 'low', format: zodOutputFormat(CommandResultSchema) },
  });

  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    return { understood: false, settings: current, narration: "The island didn't catch that. Try again?" };
  }

  const result = response.parsed_output;
  return { ...result, settings: result.understood ? clampSettings(result.settings) : current };
}
