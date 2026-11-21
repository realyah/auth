const crypto = require('crypto');

// Constant-time string comparison
const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

module.exports = { safeEqual, randomToken };
