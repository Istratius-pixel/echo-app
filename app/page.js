'use client';
import dynamic from 'next/dynamic';

// Мы загружаем основной компонент динамически только в браузере
const EchoApp = dynamic(() => import('./echo-content'), { 
  ssr: false,
  loading: () => <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#000', color:'#fff'}}>Loading ECHO...</div>
});

export default function Page() {
  return <EchoApp />;
}
