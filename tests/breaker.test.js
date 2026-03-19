const request = require('supertest');
const express = require('express');

// We must mock Redis completely before `app` is imported
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  }));
});

// We must mock rate-limiter-flexible to pass completely without blocking 429
jest.mock('rate-limiter-flexible', () => {
  return {
    RateLimiterRedis: jest.fn().mockImplementation(function () {
      this.points = 10000;
      this.consume = jest.fn().mockResolvedValue({
        remainingPoints: 9999,
        msBeforeNext: 2500,
        consumedPoints: 1,
        isFirstInDuration: true,
      });
    }),
  };
});

const app = require('../src/index');

describe('Circuit Breaker Middleware (Opossum)', () => {
  let mockServerPublic, publicApp;

  beforeAll((done) => {
    publicApp = express();
    // Continuously return 500 to simulate a completely dead/failing upstream service
    publicApp.use((req, res) => {
      res.status(500).json({ success: false, reason: 'Mock Upstream Down' });
    });
    mockServerPublic = publicApp.listen(4000, done);
  });

  afterAll((done) => {
    mockServerPublic.close(done);
  });

  it('should naturally propagate 500 downstream initially while building failure volume', async () => {
    const res = await request(app).get('/api/public/data');
    expect(res.status).toBe(500); // Because circuit is closed and the backend genuinely threw 500
  });

  it('should trip the circuit breaker and return 503 after repeated failures', async () => {
    // Fire enough requests to firmly exceed the `volumeThreshold` (3) and hit the `50% error rate` rule
    for (let i = 0; i < 4; i++) {
        await request(app).get('/api/public/data');
    }

    // Now the next request should instantly fail with 503 Circuit Open without ever touching the socket
    const res = await request(app).get('/api/public/data');
    
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/Circuit Open/i);
  });

  it('should have a timeout of 5000ms configured in the circuit breaker', () => {
    const { getCircuitBreaker } = require('../src/services/breaker');
    const breaker = getCircuitBreaker('http://localhost:4000', jest.fn());
    expect(breaker.options.timeout).toBe(5000);
  });
});
