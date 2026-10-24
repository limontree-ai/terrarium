import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HUD } from "../ui/HUD.jsx";
import { ChangeCard } from "../ui/ChangeCard.jsx";
import { VoiceController } from "../voice/voice-controller.js";
import { LearningLoop } from "../learning/learning.js";

const fakeEvaluator = { evaluateBatch: async () => [], terminate() {} };

describe("UI", () => {
  it("HUD shows round, reward, sigma and traits", () => {
    render(
      <HUD
        roundData={{
          round: 7,
          currentReward: 1.234,
          adopted: true,
          sigma: 0.1,
          traits: { limbCount: 2, height: 0.75, flatness: 1.5 },
        }}
      />
    );
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("1.23")).toBeTruthy();
    expect(screen.getByText("0.100")).toBeTruthy();
    expect(screen.getByText("adopted")).toBeTruthy();
  });

  it("ChangeCard formats missing and string values", () => {
    render(<ChangeCard setting="groundType" oldVal={undefined} newVal="ice" />);
    expect(screen.getByText("– → ice")).toBeTruthy();
  });
});

describe("VoiceController", () => {
  it("updates loop settings and shows a card per changed value", async () => {
    const loop = new LearningLoop({ evaluator: fakeEvaluator, seed: 1 });
    const cards = [];
    const onReply = vi.fn();
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ changes: { snowDepth: 0.2, wind: { strength: 1, direction: 0 } }, reply: null }),
    }));
    const voice = new VoiceController(loop, () => {}, (...c) => cards.push(c), { fetch, onReply });

    await voice.handleSpeech("snow and wind");

    expect(JSON.parse(fetch.mock.calls[0][1].body).text).toBe("snow and wind");
    expect(loop.settings.snowDepth).toBe(0.2);
    expect(loop.settings.wind).toEqual({ strength: 1, direction: 0 });
    expect(cards).toEqual([
      ["snowDepth", 0, 0.2],
      ["wind strength", 0, 1],
    ]);
  });

  it("reports server errors and an unsupported mic without throwing", async () => {
    const loop = new LearningLoop({ evaluator: fakeEvaluator, seed: 1 });
    const onReply = vi.fn();
    const fetch = vi.fn(async () => ({ ok: false, status: 500 }));
    const voice = new VoiceController(loop, () => {}, () => {}, { fetch, onReply });

    expect(voice.micSupported).toBe(false);
    voice.startListening();
    expect(onReply).toHaveBeenCalledWith("Mic error: not-supported");

    expect(await voice.handleSpeech("hello")).toBeNull();
    expect(onReply).toHaveBeenCalledWith("Voice error: server returned 500");
  });
});
