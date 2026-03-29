import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Connect from './pages/Connect';
import Tester from './pages/Tester';
import Traffic from './pages/Traffic';
import Metrics from './pages/Metrics';
import { SessionProvider } from './context/SessionContext';

export default function App() {
  return (
    <SessionProvider>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/tester" element={<Tester />} />
          <Route path="/traffic" element={<Traffic />} />
          <Route path="/metrics" element={<Metrics />} />
        </Routes>
      </main>
    </SessionProvider>
  );
}
