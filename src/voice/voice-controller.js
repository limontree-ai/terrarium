import { MicHandler } from "./speech.js";

/**
 * Voice controller: mic → server → learning loop → UI updates.
 * Settings go into the learning loop right away; physics picks them up at the
 * next round, visuals on the next frame.
 */
export class VoiceController {
  constructor(learningLoop, onSettingsChange, onChangeCard, options = {}) {
    this.learningLoop = learningLoop;
    this.onSettingsChange = onSettingsChange;
    this.onChangeCard = onChangeCard;
    this.onHeard = options.onHeard;
    this.onReply = options.onReply;
    this.onListeningChange = options.onListeningChange;
    this.fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));

    this.mic = new MicHandler(
      (text) => this.handleSpeech(text),
      (error) => this.onReply?.(`Mic error: ${error}`),
      () => this.onListeningChange?.(false)
    );

    this.isProcessing = false;
  }

  get micSupported() {
    return this.mic.supported;
  }

  async handleSpeech(transcript) {
    if (this.isProcessing || !transcript.trim()) return null;
    this.isProcessing = true;
    this.onHeard?.(transcript);

    try {
      const response = await this.fetch("/api/world", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, settings: this.learningLoop.settings }),
      });
      if (!response.ok) throw new Error(`server returned ${response.status}`);

      const { changes = {}, reply = null } = await response.json();

      const oldSettings = { ...this.learningLoop.settings };
      this.learningLoop.updateSettings(changes);
      this.onSettingsChange?.(this.learningLoop.settings);

      for (const [key, newValue] of Object.entries(changes)) {
        const oldValue = oldSettings[key];
        if (newValue && typeof newValue === "object") {
          for (const [sub, subValue] of Object.entries(newValue)) {
            if (oldValue?.[sub] !== subValue) {
              this.onChangeCard(`${key} ${sub}`, oldValue?.[sub], subValue);
            }
          }
        } else if (oldValue !== newValue) {
          this.onChangeCard(key, oldValue, newValue);
        }
      }

      if (reply) this.onReply?.(reply);
      else if (Object.keys(changes).length === 0) this.onReply?.("I didn't catch a world change in that.");

      return { changes, reply };
    } catch (err) {
      console.error("[Voice] Error:", err);
      this.onReply?.(`Voice error: ${err.message}`);
      return null;
    } finally {
      this.isProcessing = false;
    }
  }

  startListening() {
    this.onListeningChange?.(true);
    this.mic.start();
  }

  stopListening() {
    this.mic.stop();
  }
}
