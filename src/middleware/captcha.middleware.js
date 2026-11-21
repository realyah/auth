const { TURNSTILE_SECRET_KEY } = require('../config');
const { logSecurityEvent } = require('../utils/securityLogger');

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Cloudflare Turnstile check. Enforced only when TURNSTILE_SECRET_KEY is set.
// The frontend sends the widget token as body.captchaToken.
const verifyCaptcha = async (req, res, next) => {
  if (!TURNSTILE_SECRET_KEY) return next();

  const token = req.body?.captchaToken;
  if (typeof token !== 'string' || !token || token.length > 2048) {
    return res.status(400).json({ error: 'CAPTCHA verification required' });
  }

  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: TURNSTILE_SECRET_KEY, response: token, remoteip: req.ip }),
      signal: AbortSignal.timeout(5000),
    });
    const result = await response.json();
    if (!result.success) {
      logSecurityEvent('captcha.failed', { req, errors: result['error-codes'] });
      return res.status(400).json({ error: 'CAPTCHA verification failed' });
    }
    next();
  } catch (error) {
    console.error('Turnstile verification error:', error.message);
    // Fail closed: without a verified CAPTCHA the login is not allowed
    return res.status(503).json({ error: 'CAPTCHA service unavailable, please retry' });
  }
};

module.exports = { verifyCaptcha };
