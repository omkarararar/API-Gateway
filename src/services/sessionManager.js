const redisClient = require('../config/redis');
const crypto = require('crypto');
const { logger } = require('../middleware/logger');

const SESSION_PREFIX = 'gw_session:';
const SESSION_TTL = 30 * 60; // 30 minutes
const MAX_REQUESTS = 500;

const sessionManager = {
  async create({ target, middleware }) {
    const id = crypto.randomUUID().slice(0, 8);
    const session = {
      id,
      target,
      middleware: middleware || ['rateLimiter', 'circuitBreaker'],
      requestCount: 0,
      createdAt: Date.now(),
    };

    try {
      await redisClient.set(
        `${SESSION_PREFIX}${id}`,
        JSON.stringify(session),
        'EX',
        SESSION_TTL
      );
      logger.info({ sessionId: id, target }, 'Session created');
      return session;
    } catch (err) {
      logger.error({ err }, 'Failed to create session');
      throw err;
    }
  },

  async get(id) {
    try {
      const data = await redisClient.get(`${SESSION_PREFIX}${id}`);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error({ err }, 'Failed to get session');
      return null;
    }
  },

  async delete(id) {
    try {
      await redisClient.del(`${SESSION_PREFIX}${id}`);
      logger.info({ sessionId: id }, 'Session deleted');
      return true;
    } catch (err) {
      logger.error({ err }, 'Failed to delete session');
      return false;
    }
  },

  async incrementRequestCount(id) {
    const session = await this.get(id);
    if (!session) return null;

    session.requestCount++;
    const ttl = await redisClient.ttl(`${SESSION_PREFIX}${id}`);
    await redisClient.set(
      `${SESSION_PREFIX}${id}`,
      JSON.stringify(session),
      'EX',
      ttl > 0 ? ttl : SESSION_TTL
    );

    return session;
  },

  isOverLimit(session) {
    return session.requestCount >= MAX_REQUESTS;
  },

  SESSION_PREFIX,
  SESSION_TTL,
  MAX_REQUESTS,
};

module.exports = sessionManager;
