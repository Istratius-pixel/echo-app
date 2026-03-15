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
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, audioContext.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, audioContext.current.currentTime + 0.1);
    gain.gain.setValueAtTime(0.04, audioContext.current.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioContext.current.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioContext.current.destination);
    osc.start();
    osc.stop(audioContext.current.currentTime + 0.1);
  };

  const initParticles = useCallback(() => {
    particles.current = [];
    for (let i = 0; i < 450; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.current.push({
        angle, baseDist: Math.random() * 60 + 20, x: 0, y: 0,
        opacity: Math.random() * 0.7 + 0.1,
        size: 0.5 + Math.random() * 1.2,
        color: i % 10 === 0 ? '#ffffff' : '#ff0000',
        vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10
      });
    }
  }, []);

  useEffect(() => { initParticles(); }, [initParticles]);

  const speak = (text) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.3; 
    utterance.pitch = 0.7; 

    window.speechSynthesis.speak(utterance);
    
    // Эффект призрачного эха
    setTimeout(() => {
        if (isVoiceEnabled) {
            const echo = new SpeechSynthesisUtterance(text);
            echo.rate = 1.3;
            echo.pitch = 0.4;
            echo.volume = 0.15;
            window.speechSynthesis.speak(echo);
        }
    }, 150);
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
        smoothedVolume = smoothedVolume + (currentVolume - smoothedVolume) * 0.3;
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      particles.current.forEach((p) => {
        p.vx += (Math.random() - 0.5) * 2.2;
        p.vy += (Math.random() - 0.5) * 2.2;
        p.vx *= 0.95; p.vy *= 0.95;
        const volEffect = status === 'recording' ? (smoothedVolume * 6.5) : 2;
        const targetDist = p.baseDist + volEffect;
        p.x += (Math.cos(p.angle) * targetDist - p.x) * 0.15 + p.vx;
        p.y += (Math.sin(p.angle) * targetDist - p.y) * 0.15 + p.vy;
        p.angle += (status === 'thinking' ? 0.2 : 0.008) + (smoothedVolume / 300);
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
    window.speechSynthesis?.cancel();
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
    } catch (err) { setError("Mic access denied"); }
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
          messages: [
            { 
              role: "system", 
              content: "You are the ECHO intelligence core. Your mission is to provide profound, sophisticated analysis. " +
                       "1. Detect the user's language and respond EXCLUSIVELY in that language. " +
                       "2. Format: [Analysis] <Deep insight about the user's thought, ~15 words>. " +
                       "3. Format: [Directive] <Meaningful, high-level strategic advice, ~20 words>. " +
                       "Avoid simple greetings. Be authoritative and cryptic." 
            }, 
            { role: "user", content: tData.text }
          ],
          temperature: 0.5
        })
      });
      const cData = await cRes.json();
      const ai = cData.choices[0].message.content;
      
      // Более надежный парсинг
      const essence = ai.match(/Analysis\](.*?)\[/s)?.[1] || ai.split('[Directive]')[0].replace('[Analysis]', '');
      const action = ai.split('[Directive]')[1] || "Awaiting further synchronization.";
      
      setResult({ 
        essence: essence.trim(), 
        action: action.trim() 
      });
      setStatus('done');
      speak(action.trim());
    } catch (err) { setError("System Synapse Failure"); setStatus('ready'); }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-6 font-sans select-none overflow-hidden">
      <header className="w-full max-w-md flex justify-between items-center py-6">
        <h1 className="text-2xl font-black italic tracking-tighter opacity-80">ECHO <Zap size={18} className="inline text-red-600 fill-red-600" /></h1>
        <button 
          onClick={() => {
            setIsVoiceEnabled(!isVoiceEnabled);
            if (isVoiceEnabled) window.speechSynthesis.cancel();
          }}
          className={`p-2 rounded-full border transition-all ${isVoiceEnabled ? 'border-red-600 text-red-600 bg-red-600/10' : 'border-white/10 text-white/20'}`}
        >
          {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </header>

      <main className="flex-1 w-full max-w-md flex flex-col justify-center items-center relative">
        {status === 'done' && result ? (
          <div className="w-full space-y-6 animate-in fade-in zoom-in duration-700">
             <div className="bg-red-950/10 border border-white/5 p-8 rounded-[3rem] backdrop-blur-sm">
              <h2 className="text-[9px] text-white/20 uppercase mb-4 tracking-[0.3em] font-bold italic">Deep Analysis</h2>
              <p className="text-lg font-light leading-relaxed tracking-tight">{result.essence}</p>
            </div>
            <div className="bg-red-600/5 border border-red-500/20 p-8 rounded-[3rem] relative overflow-hidden backdrop-blur-md">
              <h2 className="text-[9px] text-red-500 uppercase mb-4 tracking-[0.3em] font-bold italic">Directive</h2>
              <p className="text-lg font-light text-red-50/90 leading-relaxed tracking-tight">{result.action}</p>
              {isVoiceEnabled && <div className="absolute inset-0 bg-red-600/5 animate-pulse" />}
            </div>
            <button onClick={() => { setResult(null); setStatus('ready'); window.speechSynthesis.cancel(); }} className="w-full py-6 text-white/20 text-[9px] uppercase font-black tracking-[0.8em] hover:text-red-500 transition-all active:scale-95">
              [ Synchronize ]
            </button>
          </div>
        ) : (
          <div onClick={() => status === 'ready' ? startRecording() : status === 'recording' ? mediaRecorder.current?.stop() : null} className="relative w-full aspect-square flex flex-col items-center justify-center cursor-pointer group">
            <canvas ref={canvasRef} width={600} height={600} className="w-full h-full z-10" />
            <div className="absolute bottom-10 z-20 flex flex-col items-center opacity-20 group-hover:opacity-60 transition-all duration-700">
                <p className="text-[10px] font-black uppercase tracking-[1.2em] text-white">{status === 'ready' ? 'Initialize' : status === 'recording' ? 'Acquiring' : 'Thinking'}</p>
                <div className={`h-[1px] bg-red-600 mt-4 transition-all duration-1000 ${status === 'recording' ? 'w-32 opacity-100' : 'w-8 opacity-40'}`} />
            </div>
          </div>
        )}
      </main>

      <footer className="py-8 text-center opacity-10">
        <p className="text-[9px] font-black tracking-[0.8em] uppercase text-white">© Istratius System</p>
      </footer>
    </div>
  );
}
