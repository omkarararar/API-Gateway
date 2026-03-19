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

describe('Security Headers (Helmet)', () => {
  it('should include X-Content-Type-Options: nosniff header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should include X-Frame-Options header', async () => {
    const res = await request(app).get('/health');
    // Helmet sets this to SAMEORIGIN by default
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});
