'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Zap, Volume2, VolumeX } from 'lucide-react';

export default function EchoContent() {
  const [status, setStatus] = useState('ready'); 
  const [result, setResult] = useState<{essence: string, action: string} | null>(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>(null);
  const particles = useRef<any[]>([]);

  const initParticles = useCallback(() => {
    particles.current = [];
    for (let i = 0; i < 500; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.current.push({
        angle, 
        baseDist: Math.random() * 80 + 20, 
        x: 0, y: 0,
        opacity: Math.random() * 0.4 + 0.1,
        size: Math.random() * 1.8 + 0.5,
        color: i % 15 === 0 ? '#ffffff' : '#ff1100',
        vx: 0, vy: 0,
        speed: 0.0005 + Math.random() * 0.002,
        friction: 0.95 + Math.random() * 0.03
      });
    }
  }, []);

  useEffect(() => {
    initParticles();
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [initParticles]);

  const speak = (text: string) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 1.4; // Ускоренный темп речи
    utterance.pitch = 0.75; 
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let smoothedVol = 0;
    const draw = () => {
      animationFrameId.current = requestAnimationFrame(draw);
      if (analyser.current && (status === 'recording' || status === 'thinking')) {
        const data = new Uint8Array(analyser.current.frequencyBinCount);
        analyser.current.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - 128);
        smoothedVol = smoothedVol * 0.85 + (sum / data.length) * 0.15;
      } else {
        smoothedVol *= 0.9;
      }

      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 150 + smoothedVol * 50);
      glow.addColorStop(0, 'rgba(255, 0, 0, 0.05)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.current.forEach(p => {
        p.angle += p.speed + (status === 'thinking' ? 0.04 : smoothedVol * 0.01);
        const dist = p.baseDist + (smoothedVol * 25);
        const tx = Math.cos(p.angle) * dist;
        const ty = Math.sin(p.angle) * dist;
        p.vx = (p.vx + (tx - p.x) * 0.03) * p.friction;
        p.vy = (p.vy + (ty - p.y) * 0.03) * p.friction;
        p.x += p.vx;
        p.y += p.vy;
        const finalX = cx + p.x;
        const finalY = cy + p.y;
        ctx.globalAlpha = p.opacity + (smoothedVol / 50);
        ctx.shadowBlur = status === 'recording' ? 10 : 0;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(finalX, finalY, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;
    };
    draw();
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
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
    } catch (e) { console.error(e); }
  };

  const sendToAI = async (blob: Blob) => {
    setStatus('thinking');
    try {
      const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
      const now = new Date();
      const dateTimeString = now.toLocaleString('ru-RU');

      const formData = new FormData();
      formData.append("file", blob, "audio.webm");
      formData.append("model", "whisper-large-v3");
      formData.append("language", "ru");
      
      const tRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST", headers: { "Authorization": `Bearer ${apiKey}` }, body: formData
      });
      const tData = await tRes.json();
      
      const cRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          temperature: 0.3,
          messages: [{ 
            role: "system", 
            content: `Ты — ECHO, квантовый ИИ. Текущее время на устройстве пользователя: ${dateTimeString}. Отвечай ТОЛЬКО на русском языке. Твой стиль: холодный, лаконичный, технологичный. Структура: [ANALYSIS: краткая суть] [DIRECTIVE: четкий ответ]. Никаких лишних слов.` 
          }, { role: "user", content: tData.text }]
        })
      });
      const cData = await cRes.json();
      const raw = cData.choices[0].message.content;
      
      const essence = raw.match(/\[ANALYSIS:(.*?)\]/)?.[1]?.trim() || "Связь стабилизирована.";
      const action = raw.match(/\[DIRECTIVE:(.*?)\]/)?.[1]?.trim() || "Ожидаю команд.";
      
      setResult({ essence, action });
      setStatus('done');
      speak(action);
    } catch (e) { setStatus('ready'); }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-between font-sans overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />
      <header className="relative z-10 w-full max-w-md flex justify-between items-center p-8 opacity-40">
        <h1 className="text-xl font-black italic tracking-tighter">ECHO <Zap size={14} className="inline text-red-600 fill-red-600" /></h1>
        <button onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} className="p-2">
          {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} className="text-red-900" />}
        </button>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-md flex flex-col justify-center items-center px-8">
        {status === 'done' && result ? (
          <div className="w-full space-y-6 animate-in fade-in zoom-in duration-500">
             <div className="bg-white/5 border border-white/5 p-8 rounded-[2rem] backdrop-blur-2xl">
              <h2 className="text-[7px] text-white/30 uppercase mb-4 tracking-[0.5em] font-bold">Analysis</h2>
              <p className="text-lg font-light leading-relaxed">{result.essence}</p>
            </div>
            <div className="bg-red-900/10 border border-red-500/20 p-8 rounded-[2rem] backdrop-blur-md">
              <h2 className="text-[7px] text-red-500/50 uppercase mb-4 tracking-[0.5em] font-bold">Directive</h2>
              <p className="text-lg font-medium text-red-100">{result.action}</p>
            </div>
            <button onClick={() => { setResult(null); setStatus('ready'); }} className="w-full py-4 text-[8px] uppercase tracking-[1em] text-white/10 hover:text-white transition-all">
              [ Reset Link ]
            </button>
          </div>
        ) : (
          <div 
            onClick={() => status === 'ready' ? startRecording() : status === 'recording' ? mediaRecorder.current?.stop() : null} 
            className="w-full h-80 flex items-center justify-center cursor-pointer group"
          >
            <div className="flex flex-col items-center opacity-10 group-hover:opacity-100 transition-opacity duration-1000">
                <p className="text-[9px] font-black uppercase tracking-[2em] ml-[2em]">{status === 'ready' ? 'Link' : status === 'recording' ? 'Live' : 'Think'}</p>
            </div>
          </div>
        )}
      </main>
      <footer className="relative z-10 py-10 text-center opacity-20">
        <p className="text-[9px] font-black tracking-[1em] uppercase">© Istratius</p>
      </footer>
    </div>
  );
}