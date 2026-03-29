import { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { useNavigate } from 'react-router-dom';
import NoSession from '../components/NoSession';
import './Tester.css';

export default function Tester() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/');
  const [headers, setHeaders] = useState([{ key: '', value: '' }]);
  const [body, setBody] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [burstResults, setBurstResults] = useState(null);
  const [burstRunning, setBurstRunning] = useState(false);

  if (!session) {
    return <NoSession message="Connect your API first to start testing." />;
  }

  const proxyBase = `/s/${session.id}`;

  const addHeader = () => setHeaders([...headers, { key: '', value: '' }]);
  const removeHeader = (i) => setHeaders(headers.filter((_, idx) => idx !== i));
  const updateHeader = (i, field, value) => {
    const updated = [...headers];
    updated[i][field] = value;
    setHeaders(updated);
  };

  const generateToken = async (role = 'user') => {
    try {
      const res = await fetch('/api/gateway/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      // Add or update Authorization header
      const authIdx = headers.findIndex((h) => h.key.toLowerCase() === 'authorization');
      if (authIdx >= 0) {
        const updated = [...headers];
        updated[authIdx].value = `Bearer ${data.token}`;
        setHeaders(updated);
      } else {
        setHeaders([...headers, { key: 'Authorization', value: `Bearer ${data.token}` }]);
      }
    } catch {
      // ignore
    }
  };

  const sendRequest = async () => {
    setLoading(true);
    setResponse(null);
    const start = Date.now();

    try {
      const reqHeaders = {};
      headers.forEach((h) => {
        if (h.key.trim()) reqHeaders[h.key.trim()] = h.value;
      });

      const opts = {
        method,
        headers: { ...reqHeaders },
      };

      if (['POST', 'PUT', 'PATCH'].includes(method) && body.trim()) {
        opts.body = body;
        if (!reqHeaders['Content-Type']) {
          opts.headers['Content-Type'] = 'application/json';
        }
      }

      const url = `${proxyBase}${path.startsWith('/') ? path : '/' + path}`;
      const res = await fetch(url, opts);
      const latency = Date.now() - start;

      // Extract relevant headers
      const respHeaders = {};
      for (const [k, v] of res.headers.entries()) {
        respHeaders[k] = v;
      }

      let resBody;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('json')) {
        resBody = await res.json();
      } else {
        resBody = await res.text();
      }

      setResponse({ status: res.status, headers: respHeaders, body: resBody, latency });
    } catch (err) {
      setResponse({ status: 0, headers: {}, body: err.message, latency: Date.now() - start, error: true });
    } finally {
      setLoading(false);
    }
  };

  const burstTest = async () => {
    setBurstRunning(true);
    setBurstResults(null);
    const results = [];

    for (let i = 0; i < 15; i++) {
      const start = Date.now();
      try {
        const res = await fetch(`${proxyBase}${path.startsWith('/') ? path : '/' + path}`);
        results.push({ i: i + 1, status: res.status, latency: Date.now() - start });
      } catch (err) {
        results.push({ i: i + 1, status: 0, latency: Date.now() - start, error: err.message });
      }
    }

    setBurstResults(results);
    setBurstRunning(false);
  };

  const statusClass = (s) => {
    if (s >= 500) return 'status-5xx';
    if (s >= 400) return 'status-4xx';
    if (s >= 300) return 'status-3xx';
    return 'status-2xx';
  };

  return (
    <div className="tester-page container fade-in">
      <div className="tester-header">
        <h1>API Tester</h1>
        <p className="text-secondary">
          Send requests through the gateway to <code>{session.target}</code>
        </p>
      </div>

      <div className="tester-layout">
        <div className="request-panel glass-card">
          <div className="request-bar">
            <select className="input method-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>DELETE</option>
              <option>PATCH</option>
            </select>
            <div className="path-input-wrapper">
              <span className="path-prefix">{proxyBase}</span>
              <input
                className="input path-input"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/endpoint"
              />
            </div>
            <button className="btn btn-primary" onClick={sendRequest} disabled={loading}>
              {loading ? '...' : 'Send'}
            </button>
          </div>

          <div className="request-section">
            <div className="section-header">
              <span className="form-label" style={{ margin: 0 }}>Headers</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => generateToken('user')}>
                  🔑 User JWT
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => generateToken('admin')}>
                  🔑 Admin JWT
                </button>
                <button className="btn btn-secondary btn-sm" onClick={addHeader}>+ Add</button>
              </div>
            </div>
            {headers.map((h, i) => (
              <div key={i} className="header-row">
                <input
                  className="input"
                  placeholder="Header name"
                  value={h.key}
                  onChange={(e) => updateHeader(i, 'key', e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Value"
                  value={h.value}
                  onChange={(e) => updateHeader(i, 'value', e.target.value)}
                />
                <button className="btn btn-danger btn-sm" onClick={() => removeHeader(i)}>×</button>
              </div>
            ))}
          </div>

          {['POST', 'PUT', 'PATCH'].includes(method) && (
            <div className="request-section">
              <span className="form-label">Body (JSON)</span>
              <textarea
                className="input body-input"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='{"key": "value"}'
                rows={4}
              />
            </div>
          )}

          <div className="request-actions">
            <button
              className="btn btn-secondary"
              onClick={burstTest}
              disabled={burstRunning}
            >
              {burstRunning ? 'Sending...' : '💥 Burst Test (15 rapid requests)'}
            </button>
          </div>
        </div>

        <div className="response-panel">
          {response && (
            <div className="glass-card response-card fade-in">
              <div className="response-header">
                <span className={`response-status ${response.error ? 'status-5xx' : statusClass(response.status)}`}>
                  {response.error ? 'ERROR' : response.status}
                </span>
                <span className="response-latency">{response.latency}ms</span>
              </div>

              {Object.keys(response.headers).length > 0 && (
                <div className="response-section">
                  <span className="form-label">Response Headers</span>
                  <div className="response-headers">
                    {Object.entries(response.headers).map(([k, v]) => (
                      <div key={k} className="resp-header-row">
                        <span className="resp-header-key">{k}</span>
                        <span className="resp-header-val">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="response-section">
                <span className="form-label">Body</span>
                <pre className="response-body">
                  {typeof response.body === 'object'
                    ? JSON.stringify(response.body, null, 2)
                    : response.body}
                </pre>
              </div>
            </div>
          )}

          {burstResults && (
            <div className="glass-card burst-card fade-in">
              <h3 style={{ marginBottom: '12px' }}>Burst Test Results</h3>
              <div className="burst-grid">
                {burstResults.map((r) => (
                  <div key={r.i} className={`burst-item ${statusClass(r.status)}`}>
                    <span className="burst-num">#{r.i}</span>
                    <span className={`burst-status ${statusClass(r.status)}`}>
                      {r.status || 'ERR'}
                    </span>
                    <span className="burst-latency">{r.latency}ms</span>
                  </div>
                ))}
              </div>
              <p className="burst-summary text-secondary" style={{ marginTop: '12px', fontSize: '13px' }}>
                {burstResults.filter((r) => r.status === 429).length} rate-limited •{' '}
                {burstResults.filter((r) => r.status === 503).length} circuit-broken •{' '}
                {burstResults.filter((r) => r.status >= 200 && r.status < 300).length} successful
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
