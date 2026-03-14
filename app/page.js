'use client';
import dynamic from 'next/dynamic';

const EchoApp = dynamic(() => import('./echo-content'), { 
  ssr: false,
  loading: () => <div style={{background:'#000', color:'#fff', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>Загрузка...</div>
});

export default function Page() {
  return <EchoApp />;
}
