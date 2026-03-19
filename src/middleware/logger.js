const pino = require('pino');
const env = require('../config/env');
const crypto = require('crypto');

const isDev = env.NODE_ENV === 'development';

const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password'],
    censor: '[REDACTED]',
  },
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l o',
      },
    },
  }),
});

const requestLogger = (req, res, next) => {
  // Generate or propagate correlation ID
  const correlationId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = correlationId;
  req.headers['x-request-id'] = correlationId;
  res.setHeader('x-request-id', correlationId);

  const start = Date.now();

  res.on('finish', () => {
    logger.info({
      correlationId,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      latencyMs: Date.now() - start,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
};

module.exports = { logger, requestLogger };
