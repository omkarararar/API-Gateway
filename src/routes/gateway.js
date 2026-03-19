const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { logger } = require('../middleware/logger');

const router = express.Router();

// Define routes configuration
const routes = [
  {
    path: '/api/public',
    target: 'http://localhost:4000', // Mock upstream
    middlewares: [],
  },
  {
    path: '/api/auth',
    target: 'http://localhost:4001',
    middlewares: [], 
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
      // Inject headers
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

  // Mount route
  if (route.middlewares && route.middlewares.length > 0) {
    router.use(route.path, ...route.middlewares, proxy);
  } else {
    router.use(route.path, proxy);
  }
});

module.exports = router;
