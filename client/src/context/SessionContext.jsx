import { createContext, useContext, useState, useCallback } from 'react';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);

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
  }, [session]);

  const getStatus = useCallback(async () => {
    if (!session) return null;
    const res = await fetch(`/api/gateway/status/${session.id}`);
    if (!res.ok) {
      setSession(null);
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
