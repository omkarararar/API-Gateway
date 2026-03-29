import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LightRays from '../components/LightRays';
import CurvedLoop from '../components/CurvedLoop';
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
    <div className="landing fade-in" style={{ position: 'relative' }}>
      <LightRays
        raysOrigin="top-center"
        raysColor="#ffffff"
        raysSpeed={1.3}
        lightSpread={2.0}
        rayLength={20}
        followMouse={true}
        mouseInfluence={0.1}
        noiseAmount={0}
        distortion={0}
        className="custom-rays"
        pulsating={false}
        fadeDistance={1}
        saturation={1}
      />
      <CurvedLoop
        marqueeText="One gateway to secure, scale, and observe every API. ✦ "
        interactive={false}
      />
      <section className="hero" style={{ position: 'relative' }}>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-badge">
            <span className={`health-dot ${health ? 'live' : ''}`} />
            {health ? 'Gateway Online' : 'Checking...'}
          </div>
          <h1 className="hero-title">
            Because your API deserves better than<br />
            <span className="gradient-text">‘it works on my machine.’</span>
          </h1>
          <p className="hero-subtitle">
            Paste your API URL and instantly get rate limiting, circuit breakers,
            JWT authentication, and Prometheus metrics, no code changes needed.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/connect')}>
              Connect Your API →
            </button>
            <a href="https://github.com/omkarararar/API-Gateway" target="_blank" rel="noreferrer" className="btn btn-secondary btn-lg">
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      <section className="features container">
        <div className="features-grid">
          <div className="glass-card feature-card">
            <div className="feature-icon">🛡️</div>
            <h3>Rate Limiting</h3>
            <p>Redis-backed sliding window rate limiting per IP. Protects your API from abuse with configurable thresholds.</p>
          </div>
          <div className="glass-card feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Circuit Breaker</h3>
            <p>Opossum circuit breaker per upstream. Fails fast when your API is down, auto-recovers when it's back.</p>
          </div>
          <div className="glass-card feature-card">
            <div className="feature-icon">🔐</div>
            <h3>JWT Authentication</h3>
            <p>Centralized JWT verification with role-based access control. Generate test tokens from the dashboard.</p>
          </div>
          <div className="glass-card feature-card" style={{ justifyContent: 'center' }}>
            <div className="feature-icon">📊</div>
            <h3>Prometheus Metrics</h3>
            <p>Request counts, latency histograms, error rates, and circuit breaker states, all in Prometheus format.</p>
          </div>
        </div>
      </section>

      <section className="how-it-works container" style={{ position: 'relative', zIndex: 10, marginTop: '50px' }}>
        <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '50px' }}>How It Works</h2>
        <div className="steps-grid">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Paste Your API URL</h3>
            <p>Enter any public URL or localhost endpoint</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>Send Requests Through Gateway</h3>
            <p>Use the proxy URL for all your API calls</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>See Everything Live</h3>
            <p>Monitor traffic, rates, and breaker states in real time</p>
          </div>
        </div>
      </section>
    </div>
  );
}
