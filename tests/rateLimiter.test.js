const request = require('supertest');
const express = require('express');

// 1. Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  }));
});

// 2. Mock rate-limiter-flexible
const mockConsume = jest.fn();
jest.mock('rate-limiter-flexible', () => {
  return {
    RateLimiterRedis: jest.fn().mockImplementation(function (options) {
      this.points = options.points;
      this.consume = mockConsume;
    }),
  };
});

// 3. Require the app AFTER the mocks are registered
const app = require('../src/index');

describe('Redis Rate Limiting Middleware', () => {
  let mockServerPublic, mockServerAuth;

  beforeAll((done) => {
    // Spin up mock targets so the proxy doesn't return 502 Bad Gateway when requests pass the limiter
    const publicApp = express();
    publicApp.use((req, res) => res.status(200).json({ success: true, route: 'public' }));
    mockServerPublic = publicApp.listen(4000, () => {
      const authApp = express();
      authApp.use((req, res) => res.status(200).json({ success: true, route: 'auth' }));
      mockServerAuth = authApp.listen(4001, done);
    });
  });

  afterAll((done) => {
    mockServerPublic.close(() => {
      mockServerAuth.close(done);
    });
  });

  beforeEach(() => {
    mockConsume.mockReset();
  });

  it('should pass through when request is under the limit (First request)', async () => {
    mockConsume.mockResolvedValueOnce({
      remainingPoints: 99,
      msBeforeNext: 2500,
      consumedPoints: 1,
      isFirstInDuration: true,
    });

    const res = await request(app).get('/api/public/data');
    
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('100'); // the public points config
    expect(res.headers['x-ratelimit-remaining']).toBe('99');
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('should pass through when request is exactly at the limit', async () => {
    mockConsume.mockResolvedValueOnce({
      remainingPoints: 0,
      msBeforeNext: 2500,
      consumedPoints: 100,
      isFirstInDuration: false,
    });

    const res = await request(app).get('/api/public/data');
    
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('should return 429 when request exceeds the limit', async () => {
    mockConsume.mockRejectedValueOnce({
      remainingPoints: 0,
      msBeforeNext: 60000, // 60 seconds
      consumedPoints: 101,
      isFirstInDuration: false,
    });

    const res = await request(app).get('/api/public/data');
    
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: 'Too Many Requests',
      retryAfter: 60,
    });
    expect(res.headers['retry-after']).toBe('60');
    expect(res.headers['x-ratelimit-limit']).toBe('100');
    expect(res.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('should fail open (pass through) when Redis goes offline', async () => {
    // A standard Error signifies the redis connection failed, not a quota exhaustion
    mockConsume.mockRejectedValueOnce(new Error('Connection is closed.'));

    const res = await request(app).get('/api/public/data'); // Should be permitted safely
    
    expect(res.status).toBe(200);
    // When failing open, our middleware just calls next() without injecting specific headers since it skips .then()
    expect(res.headers['x-ratelimit-remaining']).toBeUndefined();
  });

  it('should strictly limit /api/auth using its lower configured points value', async () => {
    mockConsume.mockResolvedValueOnce({
      remainingPoints: 9,
      msBeforeNext: 2500,
      consumedPoints: 1,
      isFirstInDuration: true,
    });

    const res = await request(app).get('/api/auth/login');
    
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('10'); // Ensures the auth limit configuration is effectively smaller limit
  });

  it('should use user-keyed rate limiting for authenticated routes (/api/products)', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { sub: 'user_keyed_test', roles: ['user'] },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Mock the consume to succeed — the user-keyed limiter uses req.user.sub as the key
    mockConsume.mockResolvedValue({
      remainingPoints: 49,
      msBeforeNext: 2500,
      consumedPoints: 1,
      isFirstInDuration: true,
    });

    let mockServerProducts;
    const productsApp = express();
    productsApp.use((req, res) => res.status(200).json({ success: true }));
    
    await new Promise((resolve) => {
      mockServerProducts = productsApp.listen(4002, resolve);
    });

    const res = await request(app)
      .get('/api/products/item')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    // The user-keyed limiter has 50 points
    expect(res.headers['x-ratelimit-limit']).toBe('50');

    await new Promise((resolve) => mockServerProducts.close(resolve));
  });
});
