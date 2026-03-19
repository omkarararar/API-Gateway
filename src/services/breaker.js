const CircuitBreaker = require('opossum');
const { logger } = require('../middleware/logger');

// Cache to store a singleton circuit breaker per upstream target
const breakers = new Map();

const getCircuitBreaker = (targetUrl, proxyActionPromise) => {
  if (breakers.has(targetUrl)) {
    return breakers.get(targetUrl);
  }

  const options = {
    timeout: 5000,                // If proxy takes longer than 5s, consider it failed
    errorThresholdPercentage: 50, // When 50% of requests fail, trip the circuit
    volumeThreshold: 3,           // Minimum requests to trip circuit quickly
    resetTimeout: 10000           // Wait 10s before trying to recover the upstream
  };

  const breaker = new CircuitBreaker(proxyActionPromise, options);

  // Bind graceful fallback response on Open circuit (bypasses upstream execution entirely)
  breaker.fallback((req, res, next, err) => {
    // Determine if the fallback was caused by the circuit being open or a solitary timeout.
    if (breaker.opened) {
      if (!res.headersSent) {
        return res.status(503).json({ error: 'Service Unavailable - Circuit Open' });
      }
    }
    // Return standard 502 Bad Gateway if the breaker is closed but the specific proxy call failed/timed out
    if (!res.headersSent) {
      return res.status(502).json({ error: 'Bad Gateway - Upstream Failed' });
    }
  });

  // Telemetry events
  breaker.on('open', () => logger.error(`Circuit Breaker OPENED for upstream: ${targetUrl}`));
  breaker.on('halfOpen', () => logger.warn(`Circuit Breaker HALF_OPEN for upstream: ${targetUrl}. Attempting recovery.`));
  breaker.on('close', () => logger.info(`Circuit Breaker CLOSED for upstream: ${targetUrl}. Recovery successful.`));
  
  breakers.set(targetUrl, breaker);
  return breaker;
};

module.exports = { getCircuitBreaker };
