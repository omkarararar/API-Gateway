const request = require('supertest');
const jwt = require('jsonwebtoken');
const express = require('express');

// Mock Redis and rate-limiter before app import
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  }));
});

jest.mock('rate-limiter-flexible', () => {
  return {
    RateLimiterRedis: jest.fn().mockImplementation(function (options) {
      this.points = options.points;
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

describe('JWT Authentication Middleware', () => {
  let mockServer;
  const SECRET = process.env.JWT_SECRET;

  beforeAll((done) => {
    // Spin up a mock backend for the /api/products route (target: 4002)
    const mockApp = express();
    mockApp.use((req, res) => res.status(200).json({ success: true }));
    mockServer = mockApp.listen(4002, done);
  });

  afterAll((done) => {
    mockServer.close(done);
  });

  const generateToken = (payload, options) => {
    return jwt.sign(payload, SECRET, options);
  };

  it('should return 401 if no token is provided', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toMatch(/unauthorized/i);
  });

  it('should return 401 if token is malformed', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', 'Bearer garbage_string');
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/invalid token/i);
  });

  it('should return 401/403 if token is signed with wrong secret', async () => {
    const badToken = jwt.sign({ sub: 'user_1' }, 'wrong-secret');
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/invalid token/i);
  });

  it('should return 401/403 if token is expired', async () => {
    const expiredToken = generateToken({ sub: 'user_1' }, { expiresIn: '-1h' });
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/invalid token/i);
  });

  it('should proxy through and return 200 with valid token', async () => {
    const validToken = generateToken({ sub: 'user_1', roles: ['user'] }, { expiresIn: '1h' });
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
