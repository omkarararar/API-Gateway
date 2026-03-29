import { Routes, Route, useNavigate } from 'react-router-dom';
import { VscHome, VscPlug, VscBeaker, VscListSelection, VscGraph } from 'react-icons/vsc';
import Dock from './components/Dock';
import Landing from './pages/Landing';
import Connect from './pages/Connect';
import Tester from './pages/Tester';
import Traffic from './pages/Traffic';
import Metrics from './pages/Metrics';
import { SessionProvider } from './context/SessionContext';

export default function App() {
  const navigate = useNavigate();

  const items = [
    { icon: <VscHome size={18} />, label: 'Home', onClick: () => navigate('/') },
    { icon: <VscPlug size={18} />, label: 'Connect', onClick: () => navigate('/connect') },
    { icon: <VscBeaker size={18} />, label: 'Tester', onClick: () => navigate('/tester') },
    { icon: <VscListSelection size={18} />, label: 'Traffic', onClick: () => navigate('/traffic') },
    { icon: <VscGraph size={18} />, label: 'Metrics', onClick: () => navigate('/metrics') },
  ];

  return (
    <SessionProvider>
      <main style={{ flex: 1, paddingBottom: 100 }}>
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
