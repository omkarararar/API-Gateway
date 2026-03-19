const request = require('supertest');
const express = require('express');

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

// Enable metrics for this test
process.env.METRICS_ENABLED = 'true';

const app = require('../src/index');

describe('Prometheus Metrics Endpoint', () => {
  let mockServer;

  beforeAll((done) => {
    const mockApp = express();
    mockApp.use((req, res) => res.status(200).json({ success: true }));
    mockServer = mockApp.listen(4000, done);
  });

  afterAll((done) => {
    mockServer.close(done);
  });

  it('should return 200 on GET /metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
  });

  it('should return the correct Content-Type for Prometheus', async () => {
    const res = await request(app).get('/metrics');
    expect(res.headers['content-type']).toMatch(/text\/plain|application\/openmetrics/);
  });

  it('should contain gateway_http_requests_total in the body', async () => {
    const res = await request(app).get('/metrics');
    expect(res.text).toContain('gateway_http_requests_total');
  });

  it('should increment counters after requests are made', async () => {
    // Make a request to a known endpoint first
    await request(app).get('/health');

    const res = await request(app).get('/metrics');
    expect(res.text).toContain('gateway_http_requests_total');
    expect(res.text).toContain('gateway_http_request_duration_seconds');
  });
});
