'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Zap, Volume2, VolumeX } from 'lucide-react';

export default function EchoContent() {
  const [status, setStatus] = useState('ready'); 
  const [result, setResult] = useState(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const audioContext = useRef(null);
  const analyser = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);
  const particles = useRef([]);

  // PREMIUM PARTICLES: Эффект глубокого инерционного тумана
  const initParticles = useCallback(() => {
    particles.current = [];
    for (let i = 0; i < 450; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.current.push({
        angle, 
        baseDist: Math.random() * 70 + 10, 
        x: 0, y: 0,
        opacity: Math.random() * 0.4 + 0.1,
        size: Math.random() * 1.8 + 0.2,
        color: i % 25 === 0 ? '#ffffff' : '#ff0000',
        vx: 0, vy: 0,
        speed: 0.0005 + Math.random() * 0.003,
        viscosity: 0.92 + Math.random() * 0.06
      });
    }
  }, []);

  useEffect(() => { initParticles(); }, [initParticles]);

  const speak = (text) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; 
    utterance.pitch = 0.8; 
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    let smoothedVol = 0;
    const draw = () => {
      animationFrameId.current = requestAnimationFrame(draw);
      if (analyser.current && status === 'recording') {
        const data = new Uint8Array(analyser.current.frequencyBinCount);
        analyser.current.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - 128);
        smoothedVol = smoothedVol * 0.85 + (sum / data.length) * 0.15;
      } else {
        smoothedVol *= 0.95;
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      particles.current.forEach(p => {
        p.angle += p.speed + (status === 'thinking' ? 0.04 : 0);
        const dist = p.baseDist + (smoothedVol * 15);
        const tx = Math.cos(p.angle) * dist;
        const ty = Math.sin(p.angle) * dist;

        // Плавное притяжение с инерцией
        p.vx = (p.vx + (tx - p.x) * 0.03) * p.viscosity;
        p.vy = (p.vy + (ty - p.y) * 0.03) * p.viscosity;
        p.x += p.vx;
        p.y += p.vy;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, p.opacity + (smoothedVol / 60));
        ctx.fillRect(cx + p.x, cy + p.y, p.size, p.size);
      });
    };
    draw();
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [status]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext.current = new AudioContext();
      const source = audioContext.current.createMediaStreamSource(stream);
      analyser.current = audioContext.current.createAnalyser();
      source.connect(analyser.current);
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = e => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = () => {
        sendToAI(new Blob(audioChunks.current, { type: 'audio/webm' }));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.current.start();
      setStatus('recording');
    } catch (e) { console.error("Mic error", e); }
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
          messages: [{ 
            role: "system", 
            content: "Respond in user language. Structure: [A: analysis] [D: directive]. No tags like 'Analysis:' or 'Directive:' inside the brackets." 
          }, { role: "user", content: tData.text }]
        })
      });
      const cData = await cRes.json();
      const raw = cData.choices[0].message.content;
      
      // Вырезаем текст, игнорируя любые внутренние заголовки модели
      const essence = raw.match(/\[A:(.*?)\]/s)?.[1]?.replace(/Analysis:|Анализ:/gi, '').trim() || "Link ready.";
      const action = raw.match(/\[D:(.*?)\]/s)?.[1]?.replace(/Directive:|Директива:/gi, '').trim() || "Stand by.";
      
      setResult({ essence, action });
      setStatus('done');
      speak(action);
    } catch (e) { setStatus('ready'); }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-8 font-sans overflow-hidden">
      <header className="w-full max-w-md flex justify-between items-center opacity-40">
        <h1 className="text-xl font-black italic tracking-widest">ECHO <Zap size={14} className="inline text-red-600 fill-red-600" /></h1>
        <button onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} className="p-2">
          {isVoiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} className="text-red-900" />}
        </button>
      </header>

      <main className="flex-1 w-full max-w-md flex flex-col justify-center items-center">
        {status === 'done' && result ? (
          <div className="w-full space-y-8 animate-in fade-in zoom-in-95 duration-1000">
             <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[3rem] backdrop-blur-2xl">
              <h2 className="text-[7px] text-white/20 uppercase mb-5 tracking-[0.8em] font-bold italic">Analysis</h2>
              <p className="text-xl font-light leading-relaxed tracking-wide">{result.essence}</p>
            </div>
            <div className="bg-red-950/10 border border-red-500/10 p-10 rounded-[3rem]">
              <h2 className="text-[7px] text-red-500/40 uppercase mb-5 tracking-[0.8em] font-bold italic">Directive</h2>
              <p className="text-xl font-medium text-red-100 tracking-wide">{result.action}</p>
            </div>
            <button onClick={() => { setResult(null); setStatus('ready'); }} className="w-full py-4 text-[9px] uppercase tracking-[1.5em] text-white/5 hover:text-red-500 transition-all">
              [ Re-Sync ]
            </button>
          </div>
        ) : (
          <div onClick={() => status === 'ready' ? startRecording() : status === 'recording' ? mediaRecorder.current?.stop() : null} className="relative w-96 aspect-square flex items-center justify-center cursor-pointer group">
            <canvas ref={canvasRef} width={500} height={500} className="w-full h-full" />
            <div className="absolute flex flex-col items-center opacity-10 group-hover:opacity-40 transition-opacity duration-1000">
                <p className="text-[10px] font-black uppercase tracking-[2em]">{status === 'ready' ? 'Link' : status === 'recording' ? 'Live' : 'Think'}</p>
            </div>
          </div>
        )}
      </main>

      <footer className="py-8 text-center opacity-20">
        <p className="text-[10px] font-black tracking-[1.2em] uppercase">© Istratius</p>
      </footer>
    </div>
  );
}
