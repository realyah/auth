const mongoose = require('mongoose');
const app = require('./app');
const { connectDB } = require('./config/db');
const { connectRedis, closeRedis } = require('./config/redis');
const { PORT } = require('./config');

const startServer = async () => {
  try {
    await Promise.all([connectDB(), connectRedis()]);

    const server = app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the other process or set PORT in .env.`);
      } else {
        console.error('Server error:', error);
      }
      process.exit(1);
    });

    let shuttingDown = false;
    const shutdown = (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);

      // Force exit if connections don't drain in time
      setTimeout(() => process.exit(1), 10000).unref();

      server.close(async () => {
        console.log('HTTP server closed.');
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
        await closeRedis();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
