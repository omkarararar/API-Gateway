const express = require('express');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const sessionManager = require('../services/sessionManager');
const requestCapture = require('../middleware/requestCapture');
const { breakers } = require('../services/breaker');
const { register } = require('../config/metrics');
const redisClient = require('../config/redis');

const router = express.Router();

// Connect a project — creates a gateway session
router.post('/connect', async (req, res) => {
  try {
    const { url, middleware } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are supported' });
    }

    const session = await sessionManager.create({
      target: url.replace(/\/+$/, ''), // strip trailing slashes
      middleware,
    });

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.status(201).json({
      session,
      proxyBase: `${baseUrl}/s/${session.id}`,
      usage: `All requests to ${baseUrl}/s/${session.id}/your/path are proxied to ${session.target}/your/path`,
      expiresIn: '30 minutes',
      maxRequests: sessionManager.MAX_REQUESTS,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Disconnect — delete session
router.delete('/disconnect/:id', async (req, res) => {
  const session = await sessionManager.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  await sessionManager.delete(req.params.id);
  res.json({ message: 'Session disconnected' });
});

// Get session status
router.get('/status/:id', async (req, res) => {
  const session = await sessionManager.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const ttl = await redisClient.ttl(
    `${sessionManager.SESSION_PREFIX}${req.params.id}`
  );

  res.json({
    ...session,
    remainingRequests: sessionManager.MAX_REQUESTS - session.requestCount,
    ttlSeconds: ttl,
  });
});

// Get recent request logs for a session
router.get('/logs/:id', (req, res) => {
  const logs = requestCapture.getLogs(req.params.id);
  res.json(logs);
});

// SSE stream for live request logs
router.get('/logs/:id/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sessionId = req.params.id;

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  const onRequest = (entry) => {
    if (entry.sessionId === sessionId) {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    }
  };

  requestCapture.on('request', onRequest);

  req.on('close', () => {
    requestCapture.off('request', onRequest);
  });
});

// Get aggregated stats for a session
router.get('/stats/:id', (req, res) => {
  const stats = requestCapture.getStats(req.params.id);
  res.json(stats);
});

// Get circuit breaker states
router.get('/breakers', (req, res) => {
  const states = {};
  for (const [target, breaker] of breakers) {
    states[target] = {
      state: breaker.opened ? 'open' : breaker.halfOpen ? 'halfOpen' : 'closed',
      stats: {
        successes: breaker.stats.successes,
        failures: breaker.stats.failures,
        rejects: breaker.stats.rejects,
        timeouts: breaker.stats.timeouts,
      },
    };
  }
  res.json(states);
});

// Generate a test JWT token
router.post('/token', (req, res) => {
  const { role = 'user' } = req.body || {};

  const payload =
    role === 'admin'
      ? { sub: 'test_admin', roles: ['admin', 'user'] }
      : { sub: 'test_user', roles: ['user'] };

  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });

  res.json({ token, expiresIn: '15 minutes', payload });
});

// Get Prometheus metrics as JSON
router.get('/metrics-json', async (req, res) => {
  try {
    const metrics = await register.getMetricsAsJSON();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

module.exports = router;
