import React, { useEffect, useRef, useState } from "react";
import { LearningLoop } from "../learning/learning.js";
import { VoiceController } from "../voice/voice-controller.js";
import {
  createScene,
  updateWorldVisuals,
  updateWorld,
  setTrees,
  setFood,
  landingEffect,
  render,
} from "../world3d/scene.js";
import { createBlobView, setBlobGenome, updateBlobView } from "../world3d/blob-view.js";
import { SmoothCamera } from "../world3d/camera.js";
import { mutateBody } from "../blob/mutate.js";
import { generateTreePositions } from "../physics/world.js";
import seedrandom from "seedrandom";
import { DisplaySim } from "./display-sim.js";
import { ChartPanel } from "./ChartPanel.jsx";
import { HUD } from "./HUD.jsx";
import { ChangeCard } from "./ChangeCard.jsx";
import { PHYSICS } from "../config.js";
import "./App.css";

const ROUND_INTERVAL_MS = 3000;
const CARD_MS = 3000;
const HISTORY_LENGTH = 200;
const SPAWN = { x: 0, y: 1, z: 0 };
// Player control: the blob is moved by hand with WASD while learning is wired up.
const MOVE_SPEED = 7; // m/s
const TURN_SPEED = 2.2; // rad/s
const MOVE_KEYS = { KeyW: "fwd", ArrowUp: "fwd", KeyS: "back", ArrowDown: "back", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right" };

const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

export default function App() {
  const canvasRef = useRef(null);
  const voiceRef = useRef(null);
  const [roundData, setRoundData] = useState(null);
  const [history, setHistory] = useState([]);
  const [changeCards, setChangeCards] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [heard, setHeard] = useState(null);
  const [reply, setReply] = useState(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const container = canvasRef.current;
    let disposed = false;
    let animationId;
    const timers = new Set();

    const state = createScene(container.clientWidth || 1, container.clientHeight || 1);
    container.appendChild(state.renderer.domElement);

    const loop = new LearningLoop();
    const blob = createBlobView(loop.genome);
    state.scene.add(blob.root);
    const camera = new SmoothCamera(state.camera, { offset: 8, up: 4.5 });
    updateWorldVisuals(state, loop.settings);

    // Display physics is rebuilt only at round boundaries, like the trials.
    let sim = null;
    let simSettings = null;
    let building = false;
    const buildSim = async (genome, at) => {
      building = true;
      const settings = { ...loop.settings };
      try {
        const next = await DisplaySim.create(genome, settings, loop.seed, at, sim?.food);
        if (disposed) return next.free();
        sim?.free();
        sim = next;
        updateWorldVisuals(state, settings);
        setTrees(state, next.trees);
        simSettings = settings;
      } finally {
        building = false;
      }
    };
    buildSim(loop.genome, SPAWN);

    let roundInFlight = false;
    let lastRoundEnd = performance.now();
    const runRound = async () => {
      roundInFlight = true;
      try {
        const result = await loop.runRound();
        if (disposed) return;
        setRoundData(result);
        setHistory((h) => [
          ...h.slice(-(HISTORY_LENGTH - 1)),
          { round: result.round, currentReward: result.currentReward, bestReward: result.bestReward },
        ]);

        if (result.adopted) setBlobGenome(blob, result.genome, result.bodyChanged);
        const settingsChanged = JSON.stringify(simSettings) !== JSON.stringify(loop.settings);
        if (result.adopted || settingsChanged) {
          const p = sim?.position ?? SPAWN;
          await buildSim(loop.genome, { x: p.x, y: 0.5, z: p.z });
        }
      } catch (err) {
        console.error("[Learning]", err);
      } finally {
        roundInFlight = false;
        lastRoundEnd = performance.now();
      }
    };

    const player = { x: 0, z: 0, heading: 0, speed: 0, t: 0 };
    const held = { fwd: false, back: false, left: false, right: false };
    let demoGenome = loop.genome;
    const demoRng = seedrandom("evolve-preview");
    let shownTreeKey = null;
    let last = performance.now();
    const animate = (now) => {
      animationId = requestAnimationFrame(animate);
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;

      if (!roundInFlight && now - lastRoundEnd > ROUND_INTERVAL_MS) runRound();

      if (sim) {
        sim.step(dt);
        if (sim.failed && !building) buildSim(loop.genome, SPAWN);
        const turn = (held.right ? 1 : 0) - (held.left ? 1 : 0);
        const drive = (held.fwd ? 1 : 0) - (held.back ? 0.5 : 0);
        player.heading += turn * TURN_SPEED * dt;
        player.speed = drive * MOVE_SPEED;
        player.x += Math.cos(player.heading) * player.speed * dt;
        player.z += Math.sin(player.heading) * player.speed * dt;
        const limit = PHYSICS.ARENA_HALF - 2;
        player.x = Math.max(-limit, Math.min(limit, player.x));
        player.z = Math.max(-limit, Math.min(limit, player.z));
        player.t += dt * (1 + Math.abs(player.speed));

        const pos = { x: player.x, y: sim.position.y, z: player.z };
        const heading = player.heading;
        const walk = Math.min(1, Math.abs(player.speed) / MOVE_SPEED);
        const outputs = Array.from({ length: 8 }, (_, i) => walk * Math.sin(player.t * 1.8 + i * 0.8));
        const { landed } = updateBlobView(blob, dt, sim.bodyStates(), outputs, heading);
        blob.root.position.set(pos.x, blob.root.position.y, pos.z);
        if (landed) landingEffect(state, pos, loop.settings);
        setFood(state, sim.food);
        loop.updatePosition({ x: pos.x, y: 0.5, z: pos.z }, heading, sim.food);
        camera.updateTarget(pos, heading);
      }
      updateWorldVisuals(state, loop.settings);
      // Trees are visuals first: show them right away, physics colliders follow next round.
      const treeKey = loop.settings.treeCount;
      if (treeKey !== shownTreeKey) {
        shownTreeKey = treeKey;
        setTrees(state, generateTreePositions(treeKey, loop.seed));
      }
      camera.update();
      updateWorld(state, dt, sim?.position);
      render(state);
    };
    animationId = requestAnimationFrame(animate);

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      state.camera.aspect = w / h;
      state.camera.updateProjectionMatrix();
      state.renderer.setSize(w, h);
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(container);

    const voice = new VoiceController(
      loop,
      () => {},
      (setting, oldVal, newVal) => {
        const id = `${Date.now()}-${Math.random()}`;
        setChangeCards((prev) => [...prev, { id, setting, oldVal, newVal }]);
        const timer = setTimeout(() => {
          timers.delete(timer);
          setChangeCards((prev) => prev.filter((c) => c.id !== id));
        }, CARD_MS);
        timers.add(timer);
      },
      { onHeard: setHeard, onReply: setReply, onListeningChange: setIsListening }
    );
    voiceRef.current = voice;
    setMicSupported(voice.micSupported);

    // Space = push to talk, WASD / arrows = move, E = preview a body mutation.
    let spaceHeld = false;
    const onKeyDown = (e) => {
      if (isTyping(e.target)) return;
      const dir = MOVE_KEYS[e.code];
      if (dir) {
        e.preventDefault();
        held[dir] = true;
        return;
      }
      if (e.code === "KeyE" && !e.repeat) {
        try {
          demoGenome = mutateBody(demoGenome, demoRng);
          setBlobGenome(blob, demoGenome, true);
        } catch (err) {
          console.error("[Evolve preview]", err);
        }
        return;
      }
      if (e.code !== "Space") return;
      e.preventDefault();
      if (e.repeat || spaceHeld || !voice.micSupported) return;
      spaceHeld = true;
      voice.startListening();
    };
    const onKeyUp = (e) => {
      const dir = MOVE_KEYS[e.code];
      if (dir) {
        held[dir] = false;
        return;
      }
      if (e.code !== "Space" || !spaceHeld) return;
      e.preventDefault();
      spaceHeld = false;
      voice.stopListening();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      disposed = true;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cancelAnimationFrame(animationId);
      observer?.disconnect();
      timers.forEach(clearTimeout);
      voice.stopListening();
      loop.terminate();
      sim?.free();
      state.renderer.dispose();
      state.renderer.domElement?.remove();
    };
  }, []);

  const startMic = (e) => {
    e.preventDefault();
    voiceRef.current?.startListening();
  };
  const stopMic = () => {
    if (isListening) voiceRef.current?.stopListening();
  };
  const submitTyped = (e) => {
    e.preventDefault();
    if (!typed.trim()) return;
    voiceRef.current?.handleSpeech(typed.trim());
    setTyped("");
  };

  return (
    <div className="app-container">
      <div className="canvas" ref={canvasRef}>
        <div className="demo-badge">WASD / arrows: move &nbsp;·&nbsp; E: preview a body mutation &nbsp;·&nbsp; hold Space or type below: change the world</div>
        <div className="change-cards">
          {changeCards.map((card) => (
            <ChangeCard key={card.id} {...card} />
          ))}
        </div>

        <div className="mic-button">
          {(heard || reply) && (
            <div className="voice-log">
              {heard && <div>You: “{heard}”</div>}
              {reply && <div className="voice-reply">{reply}</div>}
            </div>
          )}
          {micSupported ? (
            <button
              onPointerDown={startMic}
              onPointerUp={stopMic}
              onPointerLeave={stopMic}
              className={isListening ? "listening" : ""}
            >
              🎤 {isListening ? "Listening..." : "Hold to speak (or hold Space)"}
            </button>
          ) : (
            <div className="voice-reply">Voice needs Chrome, Edge or Safari. Type a command instead.</div>
          )}
          <form className="text-command" onSubmit={submitTyped}>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="or type: make it snow"
              aria-label="Type a command"
            />
          </form>
        </div>
      </div>

      <div className="sidebar">
        <HUD roundData={roundData} />
        <ChartPanel history={history} />
      </div>
    </div>
  );
}
