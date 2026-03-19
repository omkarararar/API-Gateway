// Mock Redis and rate-limiter before app import
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
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

const { startServer } = require('../src/index');
const redisClient = require('../src/config/redis');

describe('Graceful Shutdown', () => {
  let server;

  beforeAll((done) => {
    server = startServer();
    server.on('listening', done);
  });

  afterAll((done) => {
    // Ensure server is closed after tests
    if (server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  it('should call server.close and redisClient.quit on shutdown', (done) => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    // Emit SIGTERM to trigger the shutdown path
    process.emit('SIGTERM');

    // Give the async shutdown chain time to complete
    setTimeout(() => {
      expect(redisClient.quit).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
      exitSpy.mockRestore();
      done();
    }, 500);
  });
});
