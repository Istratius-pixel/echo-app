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
    osc.frequency.setValueAtTime(1000, audioContext.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioContext.current.currentTime + 0.1);
    gain.gain.setValueAtTime(0.03, audioContext.current.currentTime);
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
        angle, 
        baseDist: Math.random() * 60 + 20, 
        x: 0, y: 0,
        opacity: Math.random() * 0.7 + 0.1,
        size: Math.random() * 1.5 + 0.5,
        color: i % 12 === 0 ? '#ffffff' : '#ff0000',
        vx: (Math.random() - 0.5) * 8, 
        vy: (Math.random() - 0.5) * 8
      });
    }
  }, []);

  useEffect(() => { initParticles(); }, [initParticles]);

  const speak = (text) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.2; 
    utterance.pitch = 0.8; 
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
        smoothedVolume = smoothedVolume + (currentVolume - smoothedVolume) * 0.25;
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      particles.current.forEach((p) => {
        p.vx += (Math.random() - 0.5) * 1.5;
        p.vy += (Math.random() - 0.5) * 1.5;
        p.vx *= 0.96; p.vy *= 0.96;

        const volEffect = status === 'recording' ? (smoothedVolume * 7) : 2;
        const targetDist = p.baseDist + volEffect;
        
        p.x += (Math.cos(p.angle) * targetDist - p.x) * 0.1 + p.vx;
        p.y += (Math.sin(p.angle) * targetDist - p.y) * 0.1 + p.vy;
        p.angle += (status === 'thinking' ? 0.15 : 0.01) + (smoothedVolume / 400);

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
              content: "Respond in user's language. Use 2 lines only. Line 1: Clear summary of user's request. Line 2: Specific advice or response. No extra text." 
            }, 
            { role: "user", content: tData.text }
          ]
        })
      });
      const cData = await cRes.json();
      const aiResponse = cData.choices[0].message.content.trim();
      
      const lines = aiResponse.split('\n').filter(l => l.trim().length > 0);
      const essence = lines[0] || "Processing complete.";
      const action = lines[1] || "System operational.";
      
      setResult({ essence, action });
      setStatus('done');
      speak(action);
    } catch (err) { setError("Sync error"); setStatus('ready'); }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-6 font-sans select-none overflow-hidden">
      <header className="w-full max-w-md flex justify-between items-center py-6">
        <h1 className="text-2xl font-black italic tracking-tighter opacity-80">ECHO <Zap size={18} className="inline text-red-600 fill-red-600" /></h1>
        <button 
          onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
          className={`p-2 rounded-full border transition-all ${isVoiceEnabled ? 'border-red-600 text-red-600 bg-red-600/5' : 'border-white/10 text-white/20'}`}
        >
          {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </header>

      <main className="flex-1 w-full max-w-md flex flex-col justify-center items-center relative">
        {status === 'done' && result ? (
          <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
             <div className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-sm">
              <h2 className="text-[9px] text-white/20 uppercase mb-4 tracking-[0.3em] font-bold italic">Analysis</h2>
              <p className="text-xl font-light leading-relaxed">{result.essence}</p>
            </div>
            <div className="bg-red-600/5 border border-red-500/20 p-8 rounded-[2.5rem] backdrop-blur-md">
              <h2 className="text-[9px] text-red-500 uppercase mb-4 tracking-[0.3em] font-bold italic">Directive</h2>
              <p className="text-xl font-light text-red-50 leading-relaxed">{result.action}</p>
            </div>
            <button onClick={() => { setResult(null); setStatus('ready'); }} className="w-full py-6 text-white/20 text-[9px] uppercase tracking-[0.6em] font-bold hover:text-red-500 transition-all">
              [ Re-Sync ]
            </button>
          </div>
        ) : (
          <div onClick={() => status === 'ready' ? startRecording() : status === 'recording' ? mediaRecorder.current?.stop() : null} className="relative w-full aspect-square flex flex-col items-center justify-center cursor-pointer group">
            <canvas ref={canvasRef} width={600} height={600} className="w-full h-full z-10" />
            <div className="absolute bottom-10 z-20 flex flex-col items-center opacity-20 group-hover:opacity-60 transition-all duration-500">
                <p className="text-[10px] font-black uppercase tracking-[1em] text-white">{status === 'ready' ? 'Link' : status === 'recording' ? 'Live' : 'Think'}</p>
            </div>
          </div>
        )}
      </main>

      <footer className="py-8 text-center opacity-20">
        <p className="text-[10px] font-black tracking-[0.6em] uppercase text-white">© Istratius</p>
      </footer>
    </div>
  );
}
