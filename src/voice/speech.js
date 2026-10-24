/**
 * Mic handler: Web Speech API (Chrome/Safari/Edge) → final transcript text.
 */
export class MicHandler {
  constructor(onText, onError, onEnd) {
    const SpeechRecognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    this.onText = onText;
    this.onError = onError;
    this.onEnd = onEnd;
    this.listening = false;
    this.supported = Boolean(SpeechRecognition);
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    this.recognition.onstart = () => {
      this.listening = true;
    };

    this.recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) this.onText(transcript.trim());
    };

    this.recognition.onerror = (event) => {
      this.onError?.(event.error);
    };

    this.recognition.onend = () => {
      this.listening = false;
      this.onEnd?.();
    };
  }

  start() {
    if (!this.recognition) {
      this.onError?.("not-supported");
      return;
    }
    if (this.listening) return;
    try {
      this.recognition.start();
    } catch (err) {
      this.onError?.(err.message);
    }
  }

  // stop(), not abort(), so the final result of a held button is still delivered.
  stop() {
    this.recognition?.stop();
  }
}

const has = (text, pattern) => pattern.test(text);

/**
 * Fallback keyword parser (no API key, or Claude timed out).
 * Returns changes in WorldSettings shape.
 */
export function parseVoiceKeywords(text) {
  const lower = text.toLowerCase();
  const changes = {};

  // Water
  if (has(lower, /\b(dry|drain)/)) {
    changes.waterLevel = 0;
  } else if (has(lower, /\b(water|flood)/)) {
    changes.waterLevel = 1;
  }

  // Snow
  if (has(lower, /\b(clear|melt)/)) {
    changes.snowDepth = 0;
  } else if (has(lower, /\bsnow/)) {
    changes.snowDepth = 0.2;
  }

  // Rain
  if (has(lower, /\b(stop|no)( the)? rain|\bclear/)) {
    changes.rain = 0;
  } else if (has(lower, /\b(rain|storm)/)) {
    changes.rain = 1;
  }

  // Mud
  if (has(lower, /\bmud/)) changes.mud = 0.7;

  // Gravity
  if (has(lower, /\bmoon\b/)) {
    changes.gravity = 0.16;
  } else if (has(lower, /\b(normal|earth) gravity/)) {
    changes.gravity = 1;
  } else if (has(lower, /\blight(er)?\b|\b(less|low|lower) gravity/)) {
    changes.gravity = 0.5;
  } else if (has(lower, /\bheav(y|ier)\b|\b(more|high|higher|strong) gravity/)) {
    changes.gravity = 1.5;
  }

  // Wind
  if (has(lower, /\b(calm|no wind|stop( the)? wind)/)) {
    changes.wind = { strength: 0, direction: 0 };
  } else if (has(lower, /\bwind/)) {
    changes.wind = { strength: 1, direction: 0 };
  }

  // Ground
  if (has(lower, /\b(ice|icy|frozen)\b/)) changes.groundType = "ice";
  else if (has(lower, /\b(sand|sandy|desert|beach)\b/)) changes.groundType = "sand";
  else if (has(lower, /\bgrass/)) changes.groundType = "grass";

  // Time of day (visual only)
  if (has(lower, /\bnight|\bdark/)) changes.timeOfDay = "night";
  else if (has(lower, /\bsunset|\bdusk/)) changes.timeOfDay = "sunset";
  else if (has(lower, /\b(day|morning|daytime)\b/)) changes.timeOfDay = "day";

  // Trees and food
  if (has(lower, /\b(no|remove|cut down|fewer)( the)? trees/)) changes.treeCount = 0;
  else if (has(lower, /\bforest|\bmore trees/)) changes.treeCount = 24;

  if (has(lower, /\b(more|lots of) food/)) changes.food = 8;
  else if (has(lower, /\b(less|little) food/)) changes.food = 2;

  return changes;
}
