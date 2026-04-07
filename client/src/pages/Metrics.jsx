import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../context/SessionContext';
import { useNavigate } from 'react-router-dom';
import NoSession from '../components/NoSession';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import './Metrics.css';

const STATUS_COLORS = {
  '2xx': '#10b981',
  '4xx': '#f59e0b',
  '5xx': '#ef4444',
};

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'rgba(15, 15, 25, 0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#f0f0f5',
  fontSize: '12px',
};

export default function Metrics() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [breakers, setBreakers] = useState({});
  const [sessionStatus, setSessionStatus] = useState(null);
  const [rawMetrics, setRawMetrics] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [latencyData, setLatencyData] = useState([]);
  const [statusData, setStatusData] = useState([]);

  const fetchData = useCallback(async () => {
    if (!session) return;

    try {
      const [statsRes, breakersRes, statusRes, logsRes] = await Promise.all([
        fetch(`/api/gateway/stats/${session.id}`),
        fetch('/api/gateway/breakers'),
        fetch(`/api/gateway/status/${session.id}`),
        fetch(`/api/gateway/logs/${session.id}`),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (breakersRes.ok) setBreakers(await breakersRes.json());
      if (statusRes.ok) setSessionStatus(await statusRes.json());

      if (logsRes.ok) {
        const logs = await logsRes.json();
        if (Array.isArray(logs) && logs.length > 0) {
          // Build latency time-series (most recent 50)
          const sorted = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-50);
          setLatencyData(sorted.map((l, i) => ({
            name: new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            latency: l.latency || 0,
            status: l.status,
          })));

          // Build status distribution
          const counts = { '2xx': 0, '4xx': 0, '5xx': 0 };
          logs.forEach((l) => {
            if (l.status >= 200 && l.status < 300) counts['2xx']++;
            else if (l.status >= 400 && l.status < 500) counts['4xx']++;
            else if (l.status >= 500) counts['5xx']++;
          });
          setStatusData(
            Object.entries(counts)
              .filter(([, v]) => v > 0)
              .map(([name, value]) => ({ name, value }))
          );
        }
      }
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
    return <NoSession message="Connect your API first to see metrics." />;
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

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={CHART_TOOLTIP_STYLE}>
          <p style={{ margin: '4px 8px', fontWeight: 600 }}>{label}</p>
          <p style={{ margin: '4px 8px', color: '#646cff' }}>
            {payload[0].value}ms
          </p>
        </div>
      );
    }
    return null;
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

      {/* Charts Section */}
      <div className="charts-section">
        <div className="charts-grid">
          {/* Latency Over Time */}
          <div className="glass-card chart-card">
            <h3 className="chart-title">Latency Over Time</h3>
            {latencyData.length === 0 ? (
              <div className="chart-empty">
                <p className="text-secondary">Send some requests to see latency data.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={latencyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#646cff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#646cff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#8a8a9a', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: '#8a8a9a', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                    unit="ms"
                    width={55}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke="#646cff"
                    strokeWidth={2}
                    fill="url(#latencyGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#646cff', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Status Distribution */}
          <div className="glass-card chart-card">
            <h3 className="chart-title">Status Distribution</h3>
            {statusData.length === 0 ? (
              <div className="chart-empty">
                <p className="text-secondary">No responses recorded yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#646cff'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value, name) => [`${value} requests`, name]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span style={{ color: '#8a8a9a', fontSize: '12px', marginLeft: '4px' }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

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
