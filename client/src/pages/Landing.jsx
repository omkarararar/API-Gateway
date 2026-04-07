import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiShieldCheck, PiLightning, PiLockKey, PiChartBar } from 'react-icons/pi';
import ElectricBorder from '../components/ElectricBorder';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch('/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => null);
  }, []);

  return (
    <div className="landing fade-in">
      
      <header className="dashboard-header">
        <div className="system-status">
          <div className="health-badge">
            <span className={`health-dot ${health ? 'live' : ''}`} />
            {health ? 'SYSTEM.ONLINE' : 'SYSTEM.POLLING'}
          </div>
        </div>
        <div className="title-section">
          <h1>API Gateway Interface</h1>
          <p className="subtitle">
            A high-performance reverse proxy for production APIs. 
            Implements Redis-backed rate limiting, Opossum circuit breakers, JWT authentication, and Prometheus metrics without upstream code modifications.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => navigate('/connect')}>
            Initialize Connection
          </button>
          <a href="https://github.com/omkarararar/API-Gateway" target="_blank" rel="noreferrer" className="btn btn-secondary">
            View Source
          </a>
        </div>
      </header>
      <div className="layout-grid">
        <ElectricBorder color="#bc16f8" borderRadius={2} chaos={0.12} speed={1} className="features-panel">
          <section className="glass-card" style={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header">Capabilities</div>
            <div className="feature-row">
              <div className="feature-icon-wrapper">
                <PiShieldCheck size={24} />
              </div>
              <h3>Rate Limiting</h3>
              <p>Redis-backed sliding window rate limiting per IP. Strictly enforces thresholds to protect upstream integrity.</p>
            </div>
            <div className="feature-row">
              <div className="feature-icon-wrapper">
                <PiLightning size={24} />
              </div>
              <h3>Circuit Breaker</h3>
              <p>Opossum state machine per upstream origin. Shunts traffic during failure states and attempts auto-recovery during half-open ticks.</p>
            </div>
            <div className="feature-row">
              <div className="feature-icon-wrapper">
                <PiLockKey size={24} />
              </div>
              <h3>JWT Auth</h3>
              <p>Centralized cryptographic token verification. Drops unauthenticated or malformed requests before upstream propagation.</p>
            </div>
            <div className="feature-row">
              <div className="feature-icon-wrapper">
                <PiChartBar size={24} />
              </div>
              <h3>Observability</h3>
              <p>Emits Prometheus-compatible metrics encompassing request volume, latency profiles, error rates, and circuit topologies.</p>
            </div>
          </section>
        </ElectricBorder>

        <ElectricBorder color="#bc16f8" borderRadius={2} chaos={0.12} speed={1} className="workflow-panel">
          <section className="glass-card" style={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
             <div className="panel-header">Implementation Protocol</div>
             <div className="steps-list">
               <div className="step-item">
                 <span className="step-idx">[1]</span>
                 <div>
                   <h4>Register Endpoint</h4>
                   <p>Define public or localhost target</p>
                 </div>
               </div>
               <div className="step-item">
                 <span className="step-idx">[2]</span>
                 <div>
                   <h4>Reroute Traffic</h4>
                   <p>Point clients to proxy interface</p>
                 </div>
               </div>
               <div className="step-item">
                 <span className="step-idx">[3]</span>
                 <div>
                   <h4>Monitor Telemetry</h4>
                   <p>Observe state in real-time</p>
                 </div>
               </div>
             </div>
          </section>
        </ElectricBorder>
      </div>
    </div>
  );
}
