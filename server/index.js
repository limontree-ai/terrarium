import express from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 8787;

app.use(express.json());

// Vite proxy will forward /api to http://localhost:8787

// Stub voice endpoint (Prompt 5 fills this in)
app.post("/api/world", async (req, res) => {
  const { text, settings } = req.body;

  console.log(`[Voice] User said: "${text}"`);

  // TODO: Call Claude Haiku (Prompt 5)
  
  res.json({
    changes: [],
    message: "Voice control coming soon...",
  });
});

app.listen(PORT, () => {
  console.log(`[Server] Terrarium running on http://localhost:${PORT}`);
});
