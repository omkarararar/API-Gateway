const { Registry, Counter, Histogram, Gauge } = require('prom-client');

const register = new Registry();

// Collect default Node.js metrics
require('prom-client').collectDefaultMetrics({ register });

const httpRequestsTotal = new Counter({
  name: 'gateway_http_requests_total',
  help: 'Total number of HTTP requests processed by the gateway',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: 'gateway_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

const rateLimitRejectionsTotal = new Counter({
  name: 'gateway_rate_limit_rejections_total',
  help: 'Total number of rate limit rejections (429 responses)',
  labelNames: ['limiter'],
  registers: [register],
});

const circuitBreakerState = new Gauge({
  name: 'gateway_circuit_breaker_state',
  help: 'Current circuit breaker state (0=closed, 1=open, 0.5=halfOpen)',
  labelNames: ['target'],
  registers: [register],
});

const circuitBreakerTripsTotal = new Counter({
  name: 'gateway_circuit_breaker_trips_total',
  help: 'Total number of circuit breaker trips to open state',
  labelNames: ['target'],
  registers: [register],
});

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  rateLimitRejectionsTotal,
  circuitBreakerState,
  circuitBreakerTripsTotal,
};
