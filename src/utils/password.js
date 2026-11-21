const crypto = require('crypto');
const argon2 = require('argon2');
const bcryptjs = require('bcryptjs');

// OWASP Argon2id parameters (m=64 MiB, t=3, p=4 exceeds the m=19 MiB, t=2 minimum)
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 4,
};

const hashPassword = (plainPassword) => argon2.hash(plainPassword, ARGON2_OPTIONS);

// Supports Argon2 and legacy bcrypt hashes
const verifyPassword = async (hash, plainPassword) => {
  if (typeof hash !== 'string' || !hash) return false;
  try {
    if (hash.startsWith('$argon2')) return await argon2.verify(hash, plainPassword);
    return await bcryptjs.compare(plainPassword, hash);
  } catch {
    return false;
  }
};

const needsRehash = (hash) => !hash.startsWith('$argon2') || argon2.needsRehash(hash, ARGON2_OPTIONS);

// A real Argon2id hash of a random password, computed once. Verifying against it
// when the username doesn't exist makes that path take as long as a real check,
// so response time doesn't reveal which usernames exist.
let dummyHashPromise;
const getDummyHash = () => {
  dummyHashPromise ??= hashPassword(crypto.randomBytes(32).toString('hex'));
  return dummyHashPromise;
};

const burnVerifyTime = async (plainPassword) => {
  await verifyPassword(await getDummyHash(), plainPassword);
  return false;
};

module.exports = { hashPassword, verifyPassword, needsRehash, getDummyHash, burnVerifyTime };
