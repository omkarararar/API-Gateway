import { useState, useEffect, useRef } from 'react';
import { useSession } from '../context/SessionContext';
import { useNavigate } from 'react-router-dom';
import NoSession from '../components/NoSession';
import './Traffic.css';

export default function Traffic() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('all');
  const scrollRef = useRef(null);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (!session) return;

    // Load existing logs
    fetch(`/api/gateway/logs/${session.id}`)
      .then((r) => r.json())
      .then((data) => setLogs(Array.isArray(data) ? data.reverse() : []))
      .catch(() => {});

    // SSE stream
    const es = new EventSource(`/api/gateway/logs/${session.id}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      const entry = JSON.parse(e.data);
      if (entry.type === 'connected') return;
      setLogs((prev) => [entry, ...prev].slice(0, 100));
    };

    es.onerror = () => {
      // Reconnect handled by browser
    };

    return () => {
      es.close();
    };
  }, [session]);

  if (!session) {
    return <NoSession message="Connect your API first to see live traffic." />;
  }

  const statusClass = (s) => {
    if (s >= 500) return 'status-5xx';
    if (s >= 400) return 'status-4xx';
    if (s >= 300) return 'status-3xx';
    return 'status-2xx';
  };

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter((l) => {
        if (filter === '2xx') return l.status >= 200 && l.status < 300;
        if (filter === '4xx') return l.status >= 400 && l.status < 500;
        if (filter === '5xx') return l.status >= 500;
        return true;
      });

  const formatTime = (ts) => {
    try {
      return new Date(ts).toLocaleTimeString();
    } catch {
      return ts;
    }
  };

  return (
    <div className="traffic-page container fade-in">
      <div className="traffic-header">
        <div>
          <h1>Live Traffic</h1>
          <p className="text-secondary">Real-time request feed for session <code>{session.id}</code></p>
        </div>
        <div className="traffic-controls">
          <div className="filter-group">
            {['all', '2xx', '4xx', '5xx'].map((f) => (
              <button
                key={f}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f)}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            className={`btn btn-sm ${paused ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPaused(!paused)}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
      </div>

      <div className="traffic-stats">
        <div className="glass-card stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{logs.length}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Success</div>
          <div className="stat-value status-2xx">{logs.filter((l) => l.status >= 200 && l.status < 300).length}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Rate Limited</div>
          <div className="stat-value status-4xx">{logs.filter((l) => l.status === 429).length}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Errors</div>
          <div className="stat-value status-5xx">{logs.filter((l) => l.status >= 500).length}</div>
        </div>
      </div>

      <div className="traffic-feed glass-card" ref={scrollRef}>
        <div className="feed-header-row">
          <span className="feed-col-time">Time</span>
          <span className="feed-col-method">Method</span>
          <span className="feed-col-path">Path</span>
          <span className="feed-col-status">Status</span>
          <span className="feed-col-latency">Latency</span>
          <span className="feed-col-rate">Rate Left</span>
        </div>
        {filteredLogs.length === 0 ? (
          <div className="feed-empty">
            <p className="text-secondary">No requests yet. Send some traffic through the gateway!</p>
          </div>
        ) : (
          <div className="feed-body">
            {(paused ? filteredLogs : filteredLogs).map((log, i) => (
              <div key={`${log.id || i}-${log.timestamp}`} className="feed-row fade-in">
                <span className="feed-col-time">{formatTime(log.timestamp)}</span>
                <span className="feed-col-method">
                  <span className={`method-badge method-${log.method}`}>{log.method}</span>
                </span>
                <span className="feed-col-path" title={log.path}>
                  <code>{log.path}</code>
                </span>
                <span className={`feed-col-status ${statusClass(log.status)}`}>
                  {log.status}
                </span>
                <span className="feed-col-latency">{log.latency}ms</span>
                <span className="feed-col-rate">
                  {log.rateLimitRemaining !== null ? log.rateLimitRemaining : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
