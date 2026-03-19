const Redis = require('ioredis');
const env = require('./env');
const { logger } = require('../middleware/logger');

// Singleton redis client
const redisClient = new Redis(env.REDIS_URL, {
  enableOfflineQueue: false, // Don't queue up commands when offline
  maxRetriesPerRequest: 1,   // Fail fast if Redis is down so the API Gateway can fail open
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (err) => {
  logger.error({ err: err.message }, 'Redis connection error. Rate limiting will safely fail open.');
});

module.exports = redisClient;
