const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { publicRateLimiter, authRateLimiter } = require('../middleware/rateLimiter');
const { logger } = require('../middleware/logger');
const { getCircuitBreaker } = require('../services/breaker');

const router = express.Router();

// Define routes configuration
const routes = [
  {
    path: '/api/public',
    target: 'http://localhost:4000', // Mock upstream
    middlewares: [publicRateLimiter],
  },
  {
    path: '/api/auth',
    target: 'http://localhost:4001',
    middlewares: [authRateLimiter], 
  },
  {
    path: '/api/products',
    target: 'http://localhost:4002',
    middlewares: [authenticateJWT],
  },
  {
    path: '/api/admin',
    target: 'http://localhost:4003',
    middlewares: [authenticateJWT, requireRole('admin')],
  }
];

// Setup routes with proxy
routes.forEach((route) => {
  const proxy = createProxyMiddleware({
    target: route.target,
    changeOrigin: true,
    pathRewrite: (path, req) => path.replace(route.path, ''), // Strip the prefix
    onProxyReq: (proxyReq, req, res) => {
      // Inject headers (using exactly what req.headers provides thanks to our logger middleware)
      proxyReq.setHeader('x-request-id', req.id);
      if (req.user) {
        proxyReq.setHeader('x-user-id', req.user.sub);
        if (req.user.roles) {
          proxyReq.setHeader('x-user-roles', req.user.roles.join(','));
        }
      }
    },
    onError: (err, req, res) => {
      logger.error({ err, url: req.url }, 'Proxy error');
      if (!res.headersSent) {
        res.status(502).json({ error: { message: 'Bad Gateway', correlationId: req.id } });
      }
    }
  });

  // Watcher Promise required by Opossum to track socket proxying state
  const proxyActionPromise = (req, res, next) => {
    return new Promise((resolve, reject) => {
      res.on('finish', () => {
        if (res.statusCode >= 500) {
          reject(new Error(`Upstream returned HTTP ${res.statusCode}`));
        } else {
          resolve(); 
        }
      });
      
      proxy(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  const breaker = getCircuitBreaker(route.target, proxyActionPromise);

  const applyBreaker = (req, res, next) => {
    breaker.fire(req, res, next).catch((err) => {
      next(err); // Last resort catch if fallback fails
    });
  };

  // Mount route
  if (route.middlewares && route.middlewares.length > 0) {
    router.use(route.path, ...route.middlewares, applyBreaker);
  } else {
    router.use(route.path, applyBreaker);
  }
});

module.exports = router;
