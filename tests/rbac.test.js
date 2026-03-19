const request = require('supertest');
const jwt = require('jsonwebtoken');
const express = require('express');
const app = require('../src/index');

describe('Role-Based Access Control (RBAC)', () => {
  let mockServer;
  const SECRET = process.env.JWT_SECRET;

  beforeAll((done) => {
    // Spin up a mock backend for the /api/admin route (target: 4003)
    const mockApp = express();
    mockApp.use((req, res) => res.status(200).json({ success: true }));
    mockServer = mockApp.listen(4003, done);
  });

  afterAll((done) => {
    mockServer.close(done);
  });

  const generateToken = (payload) => jwt.sign(payload, SECRET, { expiresIn: '1h' });

  it('should return 401 if no token is provided on admin route', async () => {
    const res = await request(app).get('/api/admin');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/unauthorized/i);
  });

  it('should return 403 if valid token does not have admin role', async () => {
    const userToken = generateToken({ sub: 'user_1', roles: ['user'] });
    const res = await request(app)
      .get('/api/admin')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/requires admin role/i);
  });

  it('should proxy through and return 200 if valid token has admin role', async () => {
    const adminToken = generateToken({ sub: 'admin_1', roles: ['admin', 'user'] });
    const res = await request(app)
      .get('/api/admin')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
