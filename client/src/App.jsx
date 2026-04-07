import { Routes, Route, useNavigate } from 'react-router-dom';
import { PiHouse, PiPlugs, PiFlask, PiListBullets, PiChartLineUp } from 'react-icons/pi';
import Dock from './components/Dock';
import Landing from './pages/Landing';
import Connect from './pages/Connect';
import Tester from './pages/Tester';
import Traffic from './pages/Traffic';
import Metrics from './pages/Metrics';
import { SessionProvider } from './context/SessionContext';
import Particles from './components/Particles';

export default function App() {
  const navigate = useNavigate();

  const items = [
    { icon: <PiHouse size={20} />, label: 'Home', onClick: () => navigate('/') },
    { icon: <PiPlugs size={20} />, label: 'Connect', onClick: () => navigate('/connect') },
    { icon: <PiFlask size={20} />, label: 'Tester', onClick: () => navigate('/tester') },
    { icon: <PiListBullets size={20} />, label: 'Traffic', onClick: () => navigate('/traffic') },
    { icon: <PiChartLineUp size={20} />, label: 'Metrics', onClick: () => navigate('/metrics') },
  ];

  return (
    <SessionProvider>
      <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 0 }}>
        <Particles
          particleColors={["#ffffff"]}
          particleCount={200}
          particleSpread={10}
          speed={0.1}
          particleBaseSize={100}
          moveParticlesOnHover={true}
          alphaParticles={false}
          disableRotation={false}
          pixelRatio={window.devicePixelRatio || 1}
        />
      </div>
      <main style={{ flex: 1, paddingBottom: 100, position: 'relative', zIndex: 1 }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/tester" element={<Tester />} />
          <Route path="/traffic" element={<Traffic />} />
          <Route path="/metrics" element={<Metrics />} />
        </Routes>
      </main>
      <Dock items={items} panelHeight={68} baseItemSize={50} magnification={70} />
    </SessionProvider>
  );
}
