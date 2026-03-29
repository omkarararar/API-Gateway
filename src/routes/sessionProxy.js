const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const sessionManager = require('../services/sessionManager');
const { getCircuitBreaker } = require('../services/breaker');
const { publicRateLimiter } = require('../middleware/rateLimiter');
const { authenticateJWT } = require('../middleware/auth');
const { logger } = require('../middleware/logger');

const router = express.Router();

// Middleware: Look up session from Redis
const lookupSession = async (req, res, next) => {
  const { sessionId } = req.params;
  const session = await sessionManager.get(sessionId);

  if (!session) {
    return res.status(404).json({
      error: 'Session not found or expired',
      hint: 'Create a new session via POST /api/gateway/connect',
    });
  }

  if (sessionManager.isOverLimit(session)) {
    return res.status(429).json({
      error: 'Session request limit exceeded',
      limit: sessionManager.MAX_REQUESTS,
      hint: 'Create a new session to continue',
    });
  }

  req.sessionData = session;
  req.params.sessionId = sessionId; // ensure it's accessible to request capture
  await sessionManager.incrementRequestCount(sessionId);
  next();
};

// Middleware: Dynamically apply middleware based on session config
const applyDynamicMiddleware = (req, res, next) => {
  const middlewareConfig = req.sessionData.middleware || [];
  const chain = [];

  if (middlewareConfig.includes('rateLimiter')) {
    chain.push(publicRateLimiter);
  }
  if (middlewareConfig.includes('jwt')) {
    chain.push(authenticateJWT);
  }

  // Run middleware chain sequentially
  let idx = 0;
  const runNext = (err) => {
    if (err) return next(err);
    if (idx >= chain.length) return next();
    const mw = chain[idx++];
    mw(req, res, runNext);
  };
  runNext();
};

// Create a single dynamic proxy middleware
const dynamicProxy = createProxyMiddleware({
  router: (req) => req.sessionData.target,
  changeOrigin: true,
  pathRewrite: (path) => {
    // /s/abc123/api/posts → /api/posts
    return path.replace(/^\/s\/[^/]+/, '') || '/';
  },
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('x-request-id', req.id || 'unknown');
      proxyReq.setHeader('x-forwarded-by', 'api-gateway');
      if (req.user) {
        proxyReq.setHeader('x-user-id', req.user.sub);
        if (req.user.roles) {
          proxyReq.setHeader('x-user-roles', req.user.roles.join(','));
        }
      }
    },
    error: (err, req, res) => {
      logger.error({ err: err.message, url: req.url }, 'Session proxy error');
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Bad Gateway',
          message: 'Failed to reach the upstream service',
          correlationId: req.id,
        });
      }
    },
  },
});

// Proxy action wrapped for circuit breaker
const proxyAction = (req, res, next) => {
  return new Promise((resolve, reject) => {
    res.on('finish', () => {
      if (res.statusCode >= 500) {
        reject(new Error(`Upstream returned HTTP ${res.statusCode}`));
      } else {
        resolve();
      }
    });

    dynamicProxy(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Handler: proxy with or without circuit breaker based on session config
const proxyHandler = (req, res, next) => {
  const middlewareConfig = req.sessionData.middleware || [];

  if (middlewareConfig.includes('circuitBreaker')) {
    const target = req.sessionData.target;
    const breaker = getCircuitBreaker(target, proxyAction);

    breaker.fire(req, res, next).catch((err) => {
      if (!res.headersSent) {
        next(err);
      }
    });
  } else {
    dynamicProxy(req, res, next);
  }
};

// Mount catch-all session proxy route
router.use('/s/:sessionId', lookupSession, applyDynamicMiddleware, proxyHandler);

module.exports = router;
