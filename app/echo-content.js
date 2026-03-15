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
    osc.frequency.setValueAtTime(1200, audioContext.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioContext.current.currentTime + 0.1);
    gain.gain.setValueAtTime(0.01, audioContext.current.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioContext.current.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioContext.current.destination);
    osc.start();
    osc.stop(audioContext.current.currentTime + 0.1);
  };

  const initParticles = useCallback(() => {
    particles.current = [];
    for (let i = 0; i < 480; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.current.push({
        angle, 
        baseDist: Math.random() * 60 + 15, 
        x: 0, y: 0,
        opacity: Math.random() * 0.6 + 0.1,
        size: Math.random() * 1.8 + 0.4,
        color: i % 20 === 0 ? '#ffffff' : '#ff0000',
        vx: (Math.random() - 0.5) * 2, 
        vy: (Math.random() - 0.5) * 2,
        speed: 0.002 + Math.random() * 0.008
      });
    }
  }, []);

  useEffect(() => { initParticles(); }, [initParticles]);

  const speak = (text) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.2; 
    utterance.pitch = 0.85; 
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let smoothedVolume = 0;
    const drawParticles = () => {
      animationFrameId.current = requestAnimationFrame(drawParticles);
      
      if (analyser.current && status === 'recording') {
        const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
        analyser.current.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) { sum += Math.abs(dataArray[i] - 128); }
        const currentVolume = sum / dataArray.length;
        smoothedVolume = smoothedVolume + (currentVolume - smoothedVolume) * 0.15;
      } else {
        smoothedVolume *= 0.9;
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      particles.current.forEach((p) => {
        // ПРЕМИАЛЬНАЯ КИНЕМАТИКА
        const drift = status === 'thinking' ? 0.08 : 0.005;
        p.angle += p.speed + (smoothedVolume / 300) + drift;
        
        // Добавляем инерционное смещение
        p.vx += (Math.random() - 0.5) * 0.1;
        p.vy += (Math.random() - 0.5) * 0.1;
        p.vx *= 0.97; p.vy *= 0.97;

        const amplitude = p.baseDist + (smoothedVolume * 8);
        const tx = Math.cos(p.angle) * amplitude;
        const ty = Math.sin(p.angle) * amplitude;

        p.x += (tx - p.x) * 0.05 + p.vx;
        p.y += (ty - p.y) * 0.05 + p.vy;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity + (smoothedVolume / 100);
        ctx.fillRect(centerX + p.x, centerY + p.y, p.size, p.size);
      });
    };
    drawParticles();
    return () => cancelAnimationFrame(animationFrameId.current);
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
    } catch (err) { setError("Mic link failed"); }
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
              content: "In user's language. Provide a concise analytical summary and a tactical directive. " +
                       "CRITICAL: Wrap them like this: [A: analysis content] [D: directive content]. No other text." 
            }, 
            { role: "user", content: tData.text }
          ]
        })
      });
      const cData = await cRes.json();
      const raw = cData.choices[0].message.content;
      
      const essence = raw.match(/\[A:(.*?)\]/)?.[1]?.trim() || "Analysis sync lost.";
      const action = raw.match(/\[D:(.*?)\]/)?.[1]?.trim() || "Re-initialize link.";
      
      setResult({ essence, action });
      setStatus('done');
      speak(action);
    } catch (err) { setStatus('ready'); }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-6 font-sans select-none">
      <header className="w-full max-w-md flex justify-between items-center py-6">
        <h1 className="text-2xl font-black italic tracking-tighter opacity-70">ECHO <Zap size={16} className="inline text-red-600 fill-red-600" /></h1>
        <button onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} className={`p-2 rounded-full border transition-all ${isVoiceEnabled ? 'border-red-600/50 text-red-500' : 'border-white/5 text-white/10'}`}>
          {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </header>

      <main className="flex-1 w-full max-w-md flex flex-col justify-center items-center">
        {status === 'done' && result ? (
          <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-500">
             <div className="bg-white/5 border border-white/5 p-8 rounded-[2rem]">
              <h2 className="text-[8px] text-white/20 uppercase mb-3 tracking-[0.4em] font-bold">Analysis</h2>
              <p className="text-xl font-light leading-snug">{result.essence}</p>
            </div>
            <div className="bg-red-600/5 border border-red-500/10 p-8 rounded-[2rem]">
              <h2 className="text-[8px] text-red-500/50 uppercase mb-3 tracking-[0.4em] font-bold">Directive</h2>
              <p className="text-xl font-medium text-red-50 leading-snug">{result.action}</p>
            </div>
            <button onClick={() => { setResult(null); setStatus('ready'); }} className="w-full py-4 text-white/10 text-[9px] uppercase tracking-[0.6em] hover:text-white transition-all">
              [ Refresh Link ]
            </button>
          </div>
        ) : (
          <div onClick={() => status === 'ready' ? startRecording() : status === 'recording' ? mediaRecorder.current?.stop() : null} className="relative w-80 aspect-square flex items-center justify-center cursor-pointer">
            <canvas ref={canvasRef} width={400} height={400} className="w-full h-full" />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
                <p className="text-[10px] font-black uppercase tracking-[1.2em]">{status === 'ready' ? 'Start' : status === 'recording' ? 'Live' : 'Sync'}</p>
            </div>
          </div>
        )}
      </main>

      <footer className="py-10 text-center opacity-20">
        <p className="text-[10px] font-black tracking-[0.8em] uppercase">© Istratius</p>
      </footer>
    </div>
  );
}
