const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const { logger, requestLogger } = require('./middleware/logger');
const { errorHandler } = require('./middleware/errorHandler');

// Import routes
const gatewayRouter = require('./routes/gateway');

const app = express();

// Security middlewares
app.use(helmet());
app.use(cors());

// Limit payload size to prevent DOS
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Observability middlewares
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    time: new Date().toISOString()
  });
});

// Use routes
app.use('/', gatewayRouter);

// Global Error Handler
app.use(errorHandler);

const startServer = () => {
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 API Gateway started on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    logger.info({ signal }, 'Received shutdown signal, shutting down gracefully');
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 10s
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer();
