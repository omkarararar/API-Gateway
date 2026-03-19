const { RateLimiterRedis } = require('rate-limiter-flexible');
const redisClient = require('../config/redis');
const { logger } = require('./logger');

// Define the public limiter: 100 requests per 15 minutes per IP
const publicLimiterConfig = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rate_public',
  points: 100,
  duration: 15 * 60, // 15 minutes
});

// Define the auth limiter: 10 requests per 15 minutes per IP (stricter against credential stuffing)
const authLimiterConfig = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rate_auth',
  points: 10,
  duration: 15 * 60, // 15 minutes
});

// Define the user-keyed limiter: 50 requests per 15 minutes per authenticated user
const userLimiterConfig = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rate_user',
  points: 50,
  duration: 15 * 60, // 15 minutes
});

const createRateLimiterMiddleware = (rateLimiter, keyExtractor) => {
  return (req, res, next) => {
    const key = keyExtractor ? keyExtractor(req) : req.ip;
    rateLimiter.consume(key)
      .then((rateLimiterRes) => {
        // Valid request, inside the limits
        res.setHeader('X-RateLimit-Limit', rateLimiter.points);
        res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).getTime() / 1000);
        next();
      })
      .catch((rateLimiterRes) => {
        // A catch means either limits were exhausted OR an internal error occurred (e.g. Redis offline)
        if (rateLimiterRes instanceof Error) {
          logger.warn({ err: rateLimiterRes.message }, 'Rate limiter Redis failure. Failing open to allow traffic.');
          return next();
        }

        // Properly exhausted rate limits
        const retrySecs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
        
        res.setHeader('X-RateLimit-Limit', rateLimiter.points);
        res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).getTime() / 1000);
        res.setHeader('Retry-After', retrySecs);
        
        res.status(429).json({
          error: 'Too Many Requests',
          retryAfter: retrySecs
        });
      });
  };
};

const publicRateLimiter = createRateLimiterMiddleware(publicLimiterConfig);
const authRateLimiter = createRateLimiterMiddleware(authLimiterConfig);
const userRateLimiter = createRateLimiterMiddleware(userLimiterConfig, (req) => req.user?.sub || req.ip);

module.exports = { publicRateLimiter, authRateLimiter, userRateLimiter };
