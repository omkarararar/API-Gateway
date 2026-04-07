const request = require('supertest');

// Mock Redis and rate-limiter before app import
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  }));
});

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

describe('Global Error Handler Middleware', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
  });

  it('should return JSON body with error structure for runtime/parsing errors', async () => {
    // We can trigger an express.json() payload parsing error which goes to the global error handler
    const res = await request(app)
      .post('/api/public')
      .set('Content-Type', 'application/json')
      .send('{ "malformed": "json" '); // Missing closing brace
    
    expect(res.status).toBe(400); // Bad Request (SyntaxError)
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.message).toMatch(/in JSON/i);
    expect(res.body.error).not.toHaveProperty('stack');
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('should return 413 for oversized JSON payloads', async () => {
    // Generate a payload over 10kb
    const largePayload = { data: 'x'.repeat(20000) };
    const res = await request(app)
      .post('/api/public')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(largePayload));
    
    expect(res.status).toBe(413);
  });
});
