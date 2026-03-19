const jwt = require('jsonwebtoken');
require('dotenv').config();

const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_that_is_long_enough';

// 1. Generate a normal user token
const userToken = jwt.sign(
  { sub: 'user_123', roles: ['user'] }, 
  secret, 
  { expiresIn: '1h' }
);

// 2. Generate an admin token
const adminToken = jwt.sign(
  { sub: 'admin_890', roles: ['admin', 'user'] }, 
  secret, 
  { expiresIn: '1h' }
);

console.log('\n--- Normal User Token ---');
console.log(userToken);

console.log('\n--- Admin Token ---');
console.log(adminToken);
console.log('\n');
