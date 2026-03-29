const EventEmitter = require('events');

class RequestCapture extends EventEmitter {
  constructor(maxSize = 100) {
    super();
    this.setMaxListeners(50);
    this.buffer = [];
    this.maxSize = maxSize;
  }

  capture(entry) {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
    this.emit('request', entry);
  }

  getLogs(sessionId) {
    if (sessionId) {
      return this.buffer.filter((e) => e.sessionId === sessionId);
    }
    return [...this.buffer];
  }

  getStats(sessionId) {
    const logs = this.getLogs(sessionId);
    if (logs.length === 0) {
      return {
        totalRequests: 0,
        errorRate: '0.0',
        avgLatency: 0,
        rateLimitRejections: 0,
      };
    }

    const errors = logs.filter((l) => l.status >= 400);
    const rateLimitRejections = logs.filter((l) => l.status === 429);
    const totalLatency = logs.reduce((sum, l) => sum + (l.latency || 0), 0);

    return {
      totalRequests: logs.length,
      errorRate: ((errors.length / logs.length) * 100).toFixed(1),
      avgLatency: Math.round(totalLatency / logs.length),
      rateLimitRejections: rateLimitRejections.length,
    };
  }

  middleware() {
    return (req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        // Only capture session proxy requests
        if (req.originalUrl.startsWith('/s/')) {
          const entry = {
            id: req.id,
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            latency: Date.now() - start,
            sessionId: req.params?.sessionId || null,
            rateLimitRemaining: res.getHeader('x-ratelimit-remaining') ?? null,
            rateLimitLimit: res.getHeader('x-ratelimit-limit') ?? null,
          };
          this.capture(entry);
        }
      });

      next();
    };
  }
}

module.exports = new RequestCapture();
