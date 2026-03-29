import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../context/SessionContext';
import { useNavigate } from 'react-router-dom';
import './Metrics.css';

export default function Metrics() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [breakers, setBreakers] = useState({});
  const [sessionStatus, setSessionStatus] = useState(null);
  const [rawMetrics, setRawMetrics] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session) return;

    try {
      const [statsRes, breakersRes, statusRes] = await Promise.all([
        fetch(`/api/gateway/stats/${session.id}`),
        fetch('/api/gateway/breakers'),
        fetch(`/api/gateway/status/${session.id}`),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (breakersRes.ok) setBreakers(await breakersRes.json());
      if (statusRes.ok) setSessionStatus(await statusRes.json());
    } catch {
      // ignore
    }
  }, [session]);

  const fetchRawMetrics = async () => {
    try {
      const res = await fetch('/metrics');
      if (res.ok) setRawMetrics(await res.text());
    } catch {
      setRawMetrics('Failed to fetch metrics');
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!session) {
    return (
      <div className="metrics-page container fade-in">
        <div className="no-session glass-card">
          <h2>No API Connected</h2>
          <p className="text-secondary">Connect your API first to see metrics.</p>
          <button className="btn btn-primary" onClick={() => navigate('/connect')}>
            Connect Your API →
          </button>
        </div>
      </div>
    );
  }

  const breakerColor = (state) => {
    if (state === 'open') return 'badge-error';
    if (state === 'halfOpen') return 'badge-warning';
    return 'badge-success';
  };

  const breakerLabel = (state) => {
    if (state === 'open') return '● Open';
    if (state === 'halfOpen') return '◐ Half-Open';
    return '● Closed';
  };

  return (
    <div className="metrics-page container fade-in">
      <div className="metrics-header">
        <div>
          <h1>Metrics</h1>
          <p className="text-secondary">
            Real-time stats for session <code>{session.id}</code>
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}>
          ↻ Refresh
        </button>
      </div>

      {/* Session Info */}
      {sessionStatus && (
        <div className="session-info glass-card fade-in">
          <div className="session-info-grid">
            <div>
              <span className="info-label">Upstream</span>
              <code>{sessionStatus.target}</code>
            </div>
            <div>
              <span className="info-label">Requests Used</span>
              <span>{sessionStatus.requestCount} / {sessionStatus.requestCount + sessionStatus.remainingRequests}</span>
            </div>
            <div>
              <span className="info-label">TTL</span>
              <span>{Math.floor((sessionStatus.ttlSeconds || 0) / 60)}m {(sessionStatus.ttlSeconds || 0) % 60}s</span>
            </div>
            <div>
              <span className="info-label">Middleware</span>
              <div className="mw-tags">
                {sessionStatus.middleware?.map((m) => (
                  <span key={m} className="badge badge-info">{m}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="glass-card stat-card">
            <div className="stat-label">Total Requests</div>
            <div className="stat-value">{stats.totalRequests}</div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-label">Error Rate</div>
            <div className={`stat-value ${parseFloat(stats.errorRate) > 10 ? 'status-5xx' : 'status-2xx'}`}>
              {stats.errorRate}%
            </div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-label">Avg Latency</div>
            <div className="stat-value">{stats.avgLatency}<span className="stat-unit">ms</span></div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-label">Rate Limit Hits</div>
            <div className={`stat-value ${stats.rateLimitRejections > 0 ? 'status-4xx' : ''}`}>
              {stats.rateLimitRejections}
            </div>
          </div>
        </div>
      )}

      {/* Circuit Breakers */}
      <div className="breakers-section">
        <h2 className="section-title">Circuit Breakers</h2>
        {Object.keys(breakers).length === 0 ? (
          <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
            <p className="text-secondary">No circuit breakers active yet. Send some requests first.</p>
          </div>
        ) : (
          <div className="breakers-grid">
            {Object.entries(breakers).map(([target, info]) => (
              <div key={target} className="glass-card breaker-card">
                <div className="breaker-header">
                  <span className={`badge ${breakerColor(info.state)}`}>
                    {breakerLabel(info.state)}
                  </span>
                </div>
                <code className="breaker-target">{target}</code>
                <div className="breaker-stats">
                  <div>
                    <span className="stat-label">Successes</span>
                    <span className="status-2xx">{info.stats.successes}</span>
                  </div>
                  <div>
                    <span className="stat-label">Failures</span>
                    <span className="status-5xx">{info.stats.failures}</span>
                  </div>
                  <div>
                    <span className="stat-label">Rejects</span>
                    <span className="status-4xx">{info.stats.rejects}</span>
                  </div>
                  <div>
                    <span className="stat-label">Timeouts</span>
                    <span className="status-4xx">{info.stats.timeouts}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prometheus Raw */}
      <div className="raw-section">
        <div className="section-header-row">
          <h2 className="section-title" style={{ margin: 0 }}>Prometheus Metrics</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setShowRaw(!showRaw);
              if (!showRaw && !rawMetrics) fetchRawMetrics();
            }}
          >
            {showRaw ? 'Hide' : 'Show Raw Output'}
          </button>
        </div>
        {showRaw && (
          <pre className="raw-metrics glass-card fade-in">{rawMetrics || 'Loading...'}</pre>
        )}
      </div>
    </div>
  );
}
