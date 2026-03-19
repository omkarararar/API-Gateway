const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { logger } = require('./logger');

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn({ ip: req.ip, url: req.url }, 'Missing or invalid authorization header');
    return res.status(401).json({ error: { message: 'Unauthorized', correlationId: req.id } });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded; // { sub: 'userid', roles: ['admin', 'user'], ... }
    
    // Inject custom headers for upstream proxy payload propagation
    req.headers['x-user-id'] = decoded.sub;
    if (decoded.roles && Array.isArray(decoded.roles)) {
      req.headers['x-user-role'] = decoded.roles.join(',');
    }

    next();
  } catch (err) {
    logger.error({ err, ip: req.ip }, 'JWT verification failed');
    return res.status(403).json({ error: { message: 'Forbidden: Invalid token', correlationId: req.id } });
  }
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Unauthorized', correlationId: req.id } });
    }
    
    if (!req.user.roles || !req.user.roles.includes(role)) {
      logger.warn({ user: req.user.sub, roleRequired: role }, 'User missing required role');
      return res.status(403).json({ error: { message: `Forbidden: Requires ${role} role`, correlationId: req.id } });
    }

    next();
  };
};

module.exports = { authenticateJWT, requireRole };
