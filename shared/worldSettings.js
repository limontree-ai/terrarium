// World settings shared by the client (renderer + simulation) and the server (voice commands).
// RANGES is the source of truth for what the LLM is allowed to set; values are clamped to it.

export const WEATHER = ['clear', 'rain', 'snow', 'fog', 'storm'];
export const TIME_OF_DAY = ['dawn', 'day', 'dusk', 'night'];

export const RANGES = {
  gravity: { min: 0.5, max: 30, unit: 'm/s²', note: 'Earth is 9.81' },
  temperature: { min: -30, max: 50, unit: '°C' },
  treeDensity: { min: 0, max: 1, note: '0 = barren, 1 = dense forest' },
  foodAbundance: { min: 0, max: 1, note: 'how much food spawns' },
  waterLevel: { min: 0, max: 1, note: '0 = dry island, 1 = mostly flooded' },
  windStrength: { min: 0, max: 1 },
  terrainRoughness: { min: 0, max: 1, note: '0 = flat, 1 = rugged hills' },
};

export const DEFAULT_SETTINGS = {
  gravity: 9.81,
  weather: 'clear',
  timeOfDay: 'day',
  temperature: 20,
  treeDensity: 0.3,
  foodAbundance: 0.5,
  waterLevel: 0.3,
  windStrength: 0.1,
  terrainRoughness: 0.3,
};

export function clampSettings(settings) {
  const out = { ...DEFAULT_SETTINGS, ...settings };
  for (const [key, { min, max }] of Object.entries(RANGES)) {
    const n = Number(out[key]);
    out[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : DEFAULT_SETTINGS[key];
  }
  if (!WEATHER.includes(out.weather)) out.weather = DEFAULT_SETTINGS.weather;
  if (!TIME_OF_DAY.includes(out.timeOfDay)) out.timeOfDay = DEFAULT_SETTINGS.timeOfDay;
  return out;
}
