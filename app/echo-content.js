'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Zap, Volume2, VolumeX } from 'lucide-react';

export default function EchoContent() {
  const [status, setStatus] = useState('ready'); 
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const audioContext = useRef(null);
  const analyser = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);
  const particles = useRef([]);

  const playClickSound = () => {
    if (!audioContext.current) return;
    const osc = audioContext.current.createOscillator();
    const gain = audioContext.current.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioContext.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, audioContext.current.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, audioContext.current.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioContext.current.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioContext.current.destination);
    osc.start();
    osc.stop(audioContext.current.currentTime + 0.1);
  };

  const initParticles = useCallback(() => {
    particles.current = [];
    for (let i = 0; i < 400; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.current.push({
        angle, baseDist: Math.random() * 50 + 20, x: 0, y: 0,
        opacity: Math.random() * 0.5 + 0.2,
        size: 1,
        color: i % 15 === 0 ? '#ffffff' : '#ff0000',
        vx: 0, vy: 0
      });
    }
  }, []);

  useEffect(() => { initParticles(); }, [initParticles]);

  const speak = (text) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; 
    utterance.pitch = 0.9; 
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!canvasRef.current || (status !== 'recording' && status !== 'ready' && status !== 'thinking')) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let smoothedVolume = 0;
    const drawParticles = () => {
      animationFrameId.current = requestAnimationFrame(drawParticles);
      if (analyser.current) {
        const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
        analyser.current.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) { sum += Math.abs(dataArray[i] - 128); }
        const currentVolume = sum / dataArray.length;
        smoothedVolume = smoothedVolume + (currentVolume - smoothedVolume) * 0.2;
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      particles.current.forEach((p) => {
        const volEffect = status === 'recording' ? (smoothedVolume * 5) : 1;
        const targetDist = p.baseDist + volEffect;
        p.x += (Math.cos(p.angle) * targetDist - p.x) * 0.1;
        p.y += (Math.sin(p.angle) * targetDist - p.y) * 0.1;
        p.angle += (status === 'thinking' ? 0.1 : 0.005);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fillRect(centerX + p.x, centerY + p.y, p.size, p.size);
      });
    };
    drawParticles();
    return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
  }, [status]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      playClickSound();
      const source = audioContext.current.createMediaStreamSource(stream);
      analyser.current = audioContext.current.createAnalyser();
      source.connect(analyser.current);
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        sendToAI(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.current.start();
      setStatus('recording');
    } catch (err) { setError("Mic error"); }
  };

  const sendToAI = async (blob) => {
    setStatus('thinking');
    try {
      const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
      const formData = new FormData();
      formData.append("file", blob, "audio.webm");
      formData.append("model", "whisper-large-v3");
      const tRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST", headers: { "Authorization": `Bearer ${apiKey}` }, body: formData
      });
      const tData = await tRes.json();
      
      const cRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          temperature: 0.1,
          messages: [
            { 
              role: "system", 
              content: "Respond in the user's language. Format: Line 1: Brief summary of user's intent. Line 2: Concrete logical advice. No titles, no labels, no extra text." 
            }, 
            { role: "user", content: tData.text }
          ]
        })
      });
      const cData = await cRes.json();
      const aiResponse = cData.choices[0].message.content.trim();
      
      const lines = aiResponse.split('\n').filter(l => l.trim().length > 0);
      const essence = lines[0] || "Request processed.";
      const action = lines[1] || "No further action required.";
      
      setResult({ essence, action });
      setStatus('done');
      speak(action);
    } catch (err) { setError("Connection failed"); setStatus('ready'); }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-6 font-sans select-none overflow-hidden">
      <header className="w-full max-w-md flex justify-between items-center py-6">
        <h1 className="text-2xl font-black italic tracking-tighter opacity-80">ECHO <Zap size={18} className="inline text-red-600 fill-red-600" /></h1>
        <button 
          onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
          className={`p-2 rounded-full border transition-all ${isVoiceEnabled ? 'border-red-600 text-red-600' : 'border-white/10 text-white/20'}`}
        >
          {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </header>

      <main className="flex-1 w-full max-w-md flex flex-col justify-center items-center relative">
        {status === 'done' && result ? (
          <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
              <h2 className="text-[8px] text-white/30 uppercase mb-2 tracking-[0.2em] font-bold">Essence</h2>
              <p className="text-lg font-light leading-snug">{result.essence}</p>
            </div>
            <div className="bg-red-600/10 border border-red-500/30 p-6 rounded-2xl">
              <h2 className="text-[8px] text-red-500 uppercase mb-2 tracking-[0.2em] font-bold">Action</h2>
              <p className="text-lg font-medium text-red-50">{result.action}</p>
            </div>
            <button onClick={() => { setResult(null); setStatus('ready'); }} className="w-full py-4 text-white/20 text-[9px] uppercase tracking-[0.4em] hover:text-white transition-all">
              [ Reset System ]
            </button>
          </div>
        ) : (
          <div onClick={() => status === 'ready' ? startRecording() : status === 'recording' ? mediaRecorder.current?.stop() : null} className="relative w-full aspect-square flex flex-col items-center justify-center cursor-pointer group">
            <canvas ref={canvasRef} width={600} height={600} className="w-full h-full z-10" />
            <div className="absolute bottom-10 z-20 flex flex-col items-center opacity-10 group-hover:opacity-40 transition-all">
                <p className="text-[9px] font-black uppercase tracking-[0.8em] text-white">{status === 'ready' ? 'Tap to start' : status === 'recording' ? 'Listening' : 'Processing'}</p>
            </div>
          </div>
        )}
      </main>

      <footer className="py-8 text-center opacity-10">
        <p className="text-[9px] font-black tracking-[0.5em] uppercase text-white">ECHO Protocol</p>
      </footer>
    </div>
  );
}
