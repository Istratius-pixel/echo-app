'use client';
import React from 'react';

export default function EchoContent() {
  return (
    <main style={{ padding: '20px', textAlign: 'center', backgroundColor: '#000', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '3rem', marginTop: '20%' }}>ECHO</h1>
      <p style={{ opacity: 0.7 }}>Quantum AI Interface Ready</p>
      <button 
        onClick={() => alert('Система активна!')}
        style={{ padding: '10px 20px', marginTop: '20px', cursor: 'pointer', background: '#fff', color: '#000', border: 'none', borderRadius: '5px' }}
      >
        Инициализация
      </button>
    </main>
  );
}
