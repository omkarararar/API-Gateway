const { httpRequestsTotal, httpRequestDuration } = require('../config/metrics');

const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;

    // Normalise route label to avoid high-cardinality explosion
    const route = req.route?.path || req.baseUrl || 'unknown';

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status: res.statusCode,
    });

    httpRequestDuration.observe(
      { method: req.method, route, status: res.statusCode },
      durationSec
    );
  });

  next();
};

module.exports = { metricsMiddleware };
