// Compatibility bridge for legacy root entry point
const app = require('./src/app');

if (require.main === module) {
  require('./src/server');
}

module.exports = app;