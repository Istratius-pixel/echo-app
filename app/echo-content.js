'use client';
import React, { useState, useEffect, useRef } from 'react';

export default function EchoContent() {
  const [status, setStatus] = useState('IDLE'); // IDLE, LISTENING, PROCESSING
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const chatEndRef = useRef(null);

  // Та самая пульсация "микрофона"
  const getPulseColor = () => {
    if (status === 'LISTENING') return '#ff0000';
    if (status === 'PROCESSING') return '#00ffff';
    return '#333';
  };

  const handleAction = () => {
    if (status === 'IDLE') {
      setStatus('LISTENING');
      // Здесь можно добавить звук активации, как в эмуляторе
    } else if (status === 'LISTENING') {
      if (!text.trim()) {
        setStatus('IDLE');
        return;
      }
      processQuery(text);
    }
  };

  const processQuery = (query) => {
    setStatus('PROCESSING');
    const userMsg = { role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setText('');

    // Имитация "Эха Смысла"
    setTimeout(() => {
      const aiMsg = { 
        role: 'echo', 
        content: `Смысл обнаружен в резонансе: "${query}". Частота сознания стабильна.` 
      };
      setMessages(prev => [...prev, aiMsg]);
      setStatus('IDLE');
    }, 1500);
  };

  return (
    <div style={{
      backgroundColor: '#000',
      color: '#fff',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-geist-mono), monospace',
      padding: '20px',
      overflow: 'hidden'
    }}>
      {/* Статус-бар как в эмуляторе */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', opacity: 0.5, letterSpacing: '2px' }}>
        <span>CORE_RESONANCE: ACTIVE</span>
        <span>ENCRYPTION: QUANTUM</span>
      </div>

      {/* Экран вывода */}
      <div style={{ flex: 1, overflowY: 'auto', margin: '20px 0', padding: '10px', border: '1px solid #111' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: '15px', borderLeft: m.role === 'user' ? '1px solid #333' : '1px solid #0ff', paddingLeft: '10px' }}>
            <div style={{ fontSize: '8px', opacity: 0.3, marginBottom: '4px' }}>{m.role.toUpperCase()}</div>
            <div style={{ fontSize: '14px', color: m.role === 'user' ? '#ccc' : '#0ff' }}>{m.content}</div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Центральный узел (тот самый микрофон/кнопка) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <input 
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={status === 'LISTENING' ? "Слушаю..." : "Введите частоту..."}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid #222',
            color: '#fff',
            textAlign: 'center',
            width: '100%',
            outline: 'none',
            fontSize: '16px'
          }}
          onKeyPress={(e) => e.key === 'Enter' && handleAction()}
        />

        <div 
          onClick={handleAction}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: `2px solid ${getPulseColor()}`,
            boxShadow: status !== 'IDLE' ? `0 0 20px ${getPulseColor()}` : 'none',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{ width: '10px', height: '10px', backgroundColor: getPulseColor(), borderRadius: '50%' }} />
        </div>
        <div style={{ fontSize: '9px', opacity: 0.4 }}>{status}</div>
      </div>
    </div>
  );
}
