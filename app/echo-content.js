'use client';
import React, { useState, useEffect, useRef } from 'react';

export default function EchoContent() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Связь установлена. Система ЭХО СМЫСЛА активна. Жду частоту вашего запроса...' }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Эмуляция ответа AI (позже сюда можно прикрутить реальный OpenAI)
    setTimeout(() => {
      const aiResponse = { 
        role: 'ai', 
        text: `Анализ резонанса: "${input}". Смысл обнаружен в пустоте между словами. Продолжайте поиск.` 
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <main style={{
      backgroundColor: '#000',
      color: '#0ff',
      minHeight: '100vh',
      fontFamily: 'var(--font-geist-mono), monospace',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #044', paddingBottom: '10px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.2rem', letterSpacing: '4px', margin: 0 }}>ЭХО СМЫСЛА // v2.0</h1>
        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>QUANTUM ENCRYPTION ACTIVE</div>
      </header>

      {/* Chat Area */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            padding: '10px 15px',
            borderRadius: '2px',
            border: msg.role === 'user' ? '1px solid #0ff' : '1px solid #044',
            backgroundColor: msg.role === 'user' ? 'rgba(0, 255, 255, 0.05)' : 'transparent',
            fontSize: '0.9rem',
            lineHeight: '1.4'
          }}>
            <span style={{ fontSize: '0.6rem', display: 'block', marginBottom: '5px', opacity: 0.5 }}>
              {msg.role === 'user' ? 'USER_VOICE' : 'ECHO_CORE'}
            </span>
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #044', paddingTop: '20px' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Введите вопрос в пустоту..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid #0ff',
            color: '#0ff',
            outline: 'none',
            fontSize: '1rem',
            padding: '5px'
          }}
        />
        <button 
          onClick={handleSend}
          style={{
            background: '#0ff',
            color: '#000',
            border: 'none',
            padding: '10px 20px',
            cursor: 'pointer',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            fontSize: '0.8rem'
          }}
        >
          SEND
        </button>
      </div>
    </main>
  );
}
