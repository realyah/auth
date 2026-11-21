const { createClient } = require('redis');
const { REDIS_URL } = require('./index');

// Shared Redis client for sessions and rate limits. Null when REDIS_URL is not set
// (development/tests fall back to in-memory stores; production refuses to start).
// Commands issued before connectRedis() resolves are queued by the client.
const redisClient = REDIS_URL ? createClient({ url: REDIS_URL }) : null;

if (redisClient) {
  redisClient.on('error', (error) => console.error('Redis error:', error.message));
}

const connectRedis = async () => {
  if (!redisClient) {
    console.warn('REDIS_URL not set: using in-memory session and rate-limit stores (development only).');
    return null;
  }
  await redisClient.connect();
  console.log('Connected to Redis');
  return redisClient;
};

const closeRedis = async () => {
  if (redisClient?.isOpen) await redisClient.quit();
};

module.exports = { redisClient, connectRedis, closeRedis };
