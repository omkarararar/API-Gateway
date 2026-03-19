const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const app = require('../src/index');

describe('Proxy Routing & Header Injection', () => {
  let mockServer;
  let receivedRequest = null;
  const SECRET = process.env.JWT_SECRET;

  beforeAll((done) => {
    // Mock target for /api/products -> 4002
    const mockApp = express();
    mockApp.use((req, res) => {
      receivedRequest = {
        url: req.url,
        headers: req.headers,
      };
      res.status(200).json({ success: true });
    });
    mockServer = mockApp.listen(4002, done);
  });

  afterAll((done) => {
    mockServer.close(done);
  });

  beforeEach(() => {
    receivedRequest = null;
  });

  const generateToken = (payload) => jwt.sign(payload, SECRET, { expiresIn: '1h' });

  it('should strip prefix and inject identity headers before proxying', async () => {
    const token = generateToken({ sub: 'super_user_99', roles: ['user', 'admin'] });
    
    const res = await request(app)
      .get('/api/products/123?query=true')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    
    // Assert backend received the request
    expect(receivedRequest).not.toBeNull();
    
    // Assert prefix is stripped (/api/products/123 -> /123)
    expect(receivedRequest.url).toBe('/123?query=true');
    
    // Assert headers are injected
    expect(receivedRequest.headers).toHaveProperty('x-request-id');
    expect(receivedRequest.headers['x-user-id']).toBe('super_user_99');
    expect(receivedRequest.headers['x-user-roles']).toBe('user,admin');
  });
});
