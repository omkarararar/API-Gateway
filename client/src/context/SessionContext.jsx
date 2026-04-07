import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const SessionContext = createContext(null);
const STORAGE_KEY = 'gw_session';

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function saveSession(session) {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(loadSession);
  const [loading, setLoading] = useState(false);

  // Validate persisted session on mount — clear if expired
  useEffect(() => {
    if (!session) return;
    fetch(`/api/gateway/status/${session.id}`)
      .then((res) => {
        if (!res.ok) {
          setSession(null);
          saveSession(null);
        }
      })
      .catch(() => {
        // Network error — keep session, don't clear prematurely
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useCallback(async (url, middleware) => {
    setLoading(true);
    try {
      const res = await fetch('/api/gateway/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, middleware }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect');
      setSession(data.session);
      saveSession(data.session);
      return data;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!session) return;
    try {
      await fetch(`/api/gateway/disconnect/${session.id}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
    setSession(null);
    saveSession(null);
  }, [session]);

  const getStatus = useCallback(async () => {
    if (!session) return null;
    const res = await fetch(`/api/gateway/status/${session.id}`);
    if (!res.ok) {
      setSession(null);
      saveSession(null);
      return null;
    }
    return res.json();
  }, [session]);

  return (
    <SessionContext.Provider value={{ session, loading, connect, disconnect, getStatus }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
