import express from "express";
import dotenv from "dotenv";
import { parseVoiceCommand } from "./voice-api.js";

dotenv.config();

const app = express();
const PORT = 8787;
const MAX_TEXT_LENGTH = 500;

app.use(express.json());

// Voice endpoint
app.post("/api/world", async (req, res) => {
  const { text, settings } = req.body ?? {};
  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: "text must be a non-empty string" });
  }

  console.log(`[Voice] User: "${text}"`);

  try {
    const { changes, reply, source } = await parseVoiceCommand(text, settings ?? {});
    res.json({ changes, reply, source });
  } catch (err) {
    console.error("[Voice] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  const mode = process.env.ANTHROPIC_API_KEY ? "Claude" : "keyword fallback (no ANTHROPIC_API_KEY)";
  console.log(`[Server] Terrarium on http://localhost:${PORT}, voice: ${mode}`);
});
