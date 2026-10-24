import { useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS } from '../shared/worldSettings.js';
import { TerrariumScene } from './scene/TerrariumScene.js';
import { Population } from './evolution/population.js';
import VoiceInput from './ui/VoiceInput.jsx';
import StatsChart from './ui/StatsChart.jsx';
import SettingsPanel from './ui/SettingsPanel.jsx';

export default function App() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [history, setHistory] = useState([]);
  const [narration, setNarration] = useState('Say something to reshape the island.');

  // 3D scene lifecycle
  useEffect(() => {
    const scene = new TerrariumScene(canvasRef.current, settingsRef.current);
    sceneRef.current = scene;
    return () => scene.dispose();
  }, []);

  // Evolution loop: evaluate a generation in workers, show its champions, repeat.
  useEffect(() => {
    const population = new Population();
    let running = true;
    (async () => {
      while (running) {
        const stats = await population.step(settingsRef.current);
        if (!running) break;
        setHistory((h) => [...h.slice(-199), stats]);
        sceneRef.current?.showCreatures(stats.champions);
      }
    })();
    return () => {
      running = false;
      population.dispose();
    };
  }, []);

  const applySettings = (next) => {
    settingsRef.current = next;
    setSettings(next);
    sceneRef.current?.applySettings(next);
  };

  const latest = history.at(-1);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="world" />
      <header className="hud top">
        <h1>Terrarium</h1>
        <p className="narration">{narration}</p>
      </header>
      <aside className="hud side">
        <section>
          <h2>Generation {latest?.generation ?? 0}</h2>
          <p className="muted">
            Best distance {latest ? latest.best.toFixed(1) : '—'} m · avg body {latest ? latest.avgNodes.toFixed(1) : '—'} blobs
          </p>
          <StatsChart history={history} />
        </section>
        <SettingsPanel settings={settings} />
      </aside>
      <footer className="hud bottom">
        <VoiceInput
          settings={settings}
          onResult={(result) => {
            setNarration(result.narration);
            if (result.understood) applySettings(result.settings);
          }}
        />
      </footer>
    </div>
  );
}
