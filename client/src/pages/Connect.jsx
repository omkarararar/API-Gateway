import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import './Connect.css';

export default function Connect() {
  const { session, loading, connect, disconnect } = useSession();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [middleware, setMiddleware] = useState({
    rateLimiter: true,
    circuitBreaker: true,
    jwt: false,
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const toggleMiddleware = (key) => {
    setMiddleware((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    try {
      const mw = Object.entries(middleware)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const data = await connect(url.trim(), mw);
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setResult(null);
    setUrl('');
  };

  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');

  return (
    <div className="connect-page container fade-in">
      <div className="connect-header">
        <h1>Connect Your API</h1>
        <p className="text-secondary">
          Paste your API's base URL below. All requests through the gateway will
          get rate limiting, circuit breaking, and optional JWT auth applied automatically.
        </p>
      </div>

      {session && result ? (
        <div className="connected-panel">
          <div className="glass-card connected-card">
            <div className="connected-header">
              <span className="badge badge-success">● Connected</span>
              <button className="btn btn-danger btn-sm" onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
            <div className="connected-info">
              <div className="info-row">
                <span className="info-label">Upstream</span>
                <code>{session.target}</code>
              </div>
              <div className="info-row">
                <span className="info-label">Proxy Base URL</span>
                <code className="proxy-url">{result.proxyBase}</code>
              </div>
              <div className="info-row">
                <span className="info-label">Session ID</span>
                <code>{session.id}</code>
              </div>
              <div className="info-row">
                <span className="info-label">Middleware</span>
                <div className="mw-tags">
                  {session.middleware.map((m) => (
                    <span key={m} className="badge badge-info">{m}</span>
                  ))}
                </div>
              </div>
              <div className="info-row">
                <span className="info-label">Expires In</span>
                <span>30 minutes</span>
              </div>
              <div className="info-row">
                <span className="info-label">Request Limit</span>
                <span>{result.maxRequests} requests</span>
              </div>
            </div>
            <div className="connected-usage">
              <h3>Usage</h3>
              <p className="text-secondary">Replace your API base URL with the proxy URL:</p>
              <pre className="usage-code">
{`# Instead of:
curl ${session.target}/your/endpoint

# Use:
curl ${result.proxyBase}/your/endpoint`}
              </pre>
            </div>
            <div className="connected-actions">
              <button className="btn btn-primary" onClick={() => navigate('/tester')}>
                Open API Tester →
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/traffic')}>
                View Live Traffic
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form className="connect-form glass-card" onSubmit={handleConnect}>
          <div className="form-group">
            <label className="form-label">API Base URL</label>
            <input
              type="text"
              className="input input-lg"
              placeholder="https://your-api.com or http://localhost:4000"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
            {isLocalhost && (
              <div className="localhost-warning">
                ⚠️ Localhost URLs only work when running the gateway locally.
                On-cloud, use a public URL.
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Middleware</label>
            <div className="middleware-toggles">
              <label className={`mw-toggle ${middleware.rateLimiter ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={middleware.rateLimiter}
                  onChange={() => toggleMiddleware('rateLimiter')}
                />
                <span className="mw-icon">🛡️</span>
                <span className="mw-name">Rate Limiting</span>
                <span className="mw-desc">100 req / 15 min</span>
              </label>
              <label className={`mw-toggle ${middleware.circuitBreaker ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={middleware.circuitBreaker}
                  onChange={() => toggleMiddleware('circuitBreaker')}
                />
                <span className="mw-icon">⚡</span>
                <span className="mw-name">Circuit Breaker</span>
                <span className="mw-desc">Auto fail-fast on errors</span>
              </label>
              <label className={`mw-toggle ${middleware.jwt ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={middleware.jwt}
                  onChange={() => toggleMiddleware('jwt')}
                />
                <span className="mw-icon">🔐</span>
                <span className="mw-name">JWT Auth</span>
                <span className="mw-desc">Requires Bearer token</span>
              </label>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Connecting...' : 'Connect & Start Proxying →'}
          </button>
        </form>
      )}
    </div>
  );
}
