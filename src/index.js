const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const { logger, requestLogger } = require('./middleware/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { metricsMiddleware } = require('./middleware/metricsMiddleware');
const requestCapture = require('./middleware/requestCapture');
const redisClient = require('./config/redis');

// Import routes
const gatewayRouter = require('./routes/gateway');
const metricsRouter = require('./routes/metrics');
const adminRouter = require('./routes/admin');
const sessionProxyRouter = require('./routes/sessionProxy');

const app = express();

// Security — relaxed CSP for dashboard
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  })
);
app.use(cors());

// Limit payload size
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Observability
app.use(requestLogger);
app.use(metricsMiddleware);
if (process.env.NODE_ENV !== 'test') {
  app.use(requestCapture.middleware());
}

// Serve React dashboard (static build)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    time: new Date().toISOString(),
  });
});

// Prometheus metrics endpoint
if (env.METRICS_ENABLED === 'true') {
  app.use('/', metricsRouter);
}

// Dashboard admin API
app.use('/api/gateway', adminRouter);

// Session-based dynamic proxy
app.use('/', sessionProxyRouter);

// Static gateway routes (from routes.json)
app.use('/', gatewayRouter);

// Global Error Handler
app.use(errorHandler);

// SPA fallback — serve React index.html for unmatched GET routes
if (fs.existsSync(clientDist) && process.env.NODE_ENV !== 'test') {
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const startServer = () => {
  const server = app.listen(env.PORT, () => {
    logger.info(`API Gateway started on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    logger.info({ signal }, 'Received shutdown signal, shutting down gracefully');

    server.close(() => {
      logger.info('HTTP server closed, no longer accepting connections');

      redisClient
        .quit()
        .then(() => {
          logger.info('Redis connection closed');
          process.exit(0);
        })
        .catch((err) => {
          logger.error({ err: err.message }, 'Error closing Redis connection');
          process.exit(1);
        });
    });

    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
