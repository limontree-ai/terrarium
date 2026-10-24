import { parseVoiceCommand } from "../server/voice-api.js";

const MAX_TEXT_LENGTH = 500;

// Vercel serverless version of POST /api/world (same contract as server/index.js).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  const { text, settings } = req.body ?? {};
  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: "text must be a non-empty string" });
  }

  try {
    const { changes, reply, source } = await parseVoiceCommand(text, settings ?? {});
    res.json({ changes, reply, source });
  } catch (err) {
    console.error("[Voice] Error:", err);
    res.status(500).json({ error: err.message });
  }
}
