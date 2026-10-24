import { useEffect, useRef, useState } from 'react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function VoiceInput({ settings, onResult }) {
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const send = async (transcript) => {
    if (!transcript.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, settings: settingsRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      onResult(data);
      setText('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      setText(result[0].transcript);
      if (result.isFinal) send(result[0].transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = (e) => setError(`Microphone: ${e.error}`);
    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current.stop();
    } else {
      setError('');
      recognitionRef.current.start();
      setListening(true);
    }
  };

  return (
    <form
      className="voice"
      onSubmit={(e) => {
        e.preventDefault();
        send(text);
      }}
    >
      {SpeechRecognition && (
        <button type="button" className={`mic ${listening ? 'on' : ''}`} onClick={toggleMic} disabled={busy}>
          {listening ? 'Listening…' : '🎙 Speak'}
        </button>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Try "make it snow", "add trees", or "less gravity"'
        disabled={busy}
      />
      <button type="submit" disabled={busy || !text.trim()}>
        {busy ? 'Reshaping…' : 'Send'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
