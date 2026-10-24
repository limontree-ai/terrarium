import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { interpretCommand } from './commandParser.js';

const app = express();
const PORT = process.env.PORT || 3001;
const MAX_TRANSCRIPT_LENGTH = 500;

app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/command', async (req, res) => {
  const { transcript, settings } = req.body ?? {};
  if (typeof transcript !== 'string' || !transcript.trim()) {
    return res.status(400).json({ error: 'transcript is required' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Voice commands need ANTHROPIC_API_KEY set in .env' });
  }
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return res.status(400).json({ error: `transcript must be under ${MAX_TRANSCRIPT_LENGTH} characters` });
  }

  try {
    res.json(await interpretCommand(transcript.trim(), settings));
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('Invalid or missing ANTHROPIC_API_KEY');
      return res.status(500).json({ error: 'Server is missing a valid Anthropic API key' });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Too many commands at once. Try again in a moment.' });
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message);
      return res.status(502).json({ error: 'The world spirit is unavailable right now' });
    }
    console.error(error);
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

// In production, serve the built frontend from the same server.
if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Terrarium API listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn('ANTHROPIC_API_KEY is not set: voice commands are disabled. See .env.example.');
});
