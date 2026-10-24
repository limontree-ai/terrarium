import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { LearningLoop } from "../learning/learning.js";
import { VoiceController } from "../voice/voice-controller.js";
import { createScene, updateWorldVisuals, render, setCurveCenter } from "../world3d/scene.js";
import {
  createCreatureMesh,
  updateCreatureMesh,
  morphCreature,
  updateMorphAnimation,
} from "../world3d/creature.js";
import { SmoothCamera } from "../world3d/camera.js";
import { applyCurve } from "../world3d/shaders.js";
import { DisplaySim } from "./display-sim.js";
import { ChartPanel } from "./ChartPanel.jsx";
import { HUD } from "./HUD.jsx";
import { ChangeCard } from "./ChangeCard.jsx";
import "./App.css";

const ROUND_INTERVAL_MS = 3000;
const CARD_MS = 3000;
const MORPH_SECONDS = 3;
const HISTORY_LENGTH = 200;
const SPAWN = { x: 0, y: 1, z: 0 };

function createFoodMesh(curveUniforms) {
  const mat = applyCurve(
    new THREE.MeshPhongMaterial({ color: 0xff8a3d, emissive: 0xa0400a }),
    curveUniforms
  );
  return new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), mat);
}

function createTreesGroup(trees, curveUniforms) {
  const group = new THREE.Group();
  const trunkMat = applyCurve(new THREE.MeshPhongMaterial({ color: 0x8b5a2b }), curveUniforms);
  const leafMat = applyCurve(new THREE.MeshPhongMaterial({ color: 0x1e8449 }), curveUniforms);
  const trunkGeom = new THREE.CylinderGeometry(0.3, 0.3, 1, 10);
  const leafGeom = new THREE.ConeGeometry(0.9, 1.6, 10);
  for (const t of trees) {
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.set(t.x, t.y, t.z);
    const leaves = new THREE.Mesh(leafGeom, leafMat);
    leaves.position.set(t.x, t.y + 1.2, t.z);
    group.add(trunk, leaves);
  }
  return group;
}

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
    let creature = createCreatureMesh(loop.genome, state.curveUniforms);
    state.scene.add(creature);
    const food = createFoodMesh(state.curveUniforms);
    state.scene.add(food);
    let trees = null;
    const camera = new SmoothCamera(state.camera);

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
        if (JSON.stringify(simSettings?.treeCount) !== JSON.stringify(settings.treeCount) || !trees) {
          if (trees) state.scene.remove(trees);
          trees = createTreesGroup(next.trees, state.curveUniforms);
          state.scene.add(trees);
        }
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
        const oldGenome = loop.genome;
        const result = await loop.runRound();
        if (disposed) return;
        setRoundData(result);
        setHistory((h) => [
          ...h.slice(-(HISTORY_LENGTH - 1)),
          { round: result.round, currentReward: result.currentReward, bestReward: result.bestReward },
        ]);

        if (result.adopted) {
          state.scene.remove(creature);
          creature = createCreatureMesh(result.genome, state.curveUniforms);
          if (result.bodyChanged) morphCreature(creature, oldGenome, result.genome, MORPH_SECONDS);
          state.scene.add(creature);
        }
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

    let last = performance.now();
    const animate = (now) => {
      animationId = requestAnimationFrame(animate);
      const dt = Math.max(0, (now - last) / 1000);
      last = now;

      if (!roundInFlight && now - lastRoundEnd > ROUND_INTERVAL_MS) runRound();

      if (sim) {
        sim.step(dt);
        if (sim.failed && !building) buildSim(loop.genome, SPAWN);
        updateCreatureMesh(creature, sim.bodyStates(), sim.outputs, now);
        food.position.set(sim.food.x, sim.food.y, sim.food.z);
        const pos = sim.position;
        loop.updatePosition({ x: pos.x, y: 0.5, z: pos.z }, sim.heading, sim.food);
        setCurveCenter(state, pos);
        camera.updateTarget(pos, sim.heading);
      }
      updateMorphAnimation(creature, now);
      updateWorldVisuals(state, loop.settings);
      camera.update();
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

    return () => {
      disposed = true;
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
              🎤 {isListening ? "Listening..." : "Hold to Speak"}
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
