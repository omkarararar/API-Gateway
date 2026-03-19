const { logger } = require('./logger');

const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error({
    err,
    correlationId: req.id,
    url: req.url,
    method: req.method,
  }, 'Error caught in global handler');

  if (res.headersSent) {
    return next(err);
  }

  res.status(status).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      correlationId: req.id,
    },
  });
};

module.exports = { errorHandler };
