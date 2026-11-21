const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { encrypt, decrypt, sha256, safeEqual } = require('./crypto');
const { MFA_ISSUER } = require('../config');

// 30 s steps, accept the previous/next step for clock drift
authenticator.options = { step: 30, window: 1, digits: 6 };

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

const generateSecret = () => authenticator.generateSecret(20); // 160-bit

const buildEnrollment = async (username, secret) => {
  const otpauthUrl = authenticator.keyuri(username, MFA_ISSUER, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { otpauthUrl, qrCodeDataUrl, manualEntryKey: secret };
};

// Returns the time step the code matched, or null. The caller rejects any step at
// or before the last one used, so a code can't be replayed inside its window.
const verifyTotp = (encryptedSecret, code, lastUsedStep) => {
  if (!encryptedSecret || typeof code !== 'string') return null;
  const secret = decrypt(encryptedSecret);
  const delta = authenticator.checkDelta(code, secret);
  if (delta === null) return null;
  const step = Math.floor(Date.now() / 1000 / 30) + delta;
  if (lastUsedStep !== null && lastUsedStep !== undefined && step <= lastUsedStep) return null;
  return step;
};

const randomRecoveryCode = () => {
  const bytes = crypto.randomBytes(10);
  const chars = Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
};

const normalizeRecoveryCode = (code) => String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');

const generateRecoveryCodes = () => {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, randomRecoveryCode);
  return { codes, hashes: codes.map((c) => sha256(normalizeRecoveryCode(c))) };
};

// Returns the remaining hashes if the code matched, else null
const consumeRecoveryCode = (hashes, code) => {
  const hash = sha256(normalizeRecoveryCode(code));
  const index = hashes.findIndex((h) => safeEqual(h, hash));
  if (index === -1) return null;
  return hashes.filter((_, i) => i !== index);
};

module.exports = {
  generateSecret,
  encryptSecret: encrypt,
  buildEnrollment,
  verifyTotp,
  generateRecoveryCodes,
  consumeRecoveryCode,
};
