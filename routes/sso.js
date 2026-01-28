const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Issues a short-lived JWT for the legacy PHP app to consume at /session/sso_login
// GET /api/sso/php-token?pid=12345
// Returns: { token }
router.get('/php-token', async (req, res) => {
  try {
    const secret = process.env.CAREONE_PHP_SSO_SECRET || process.env.JWT_SECRET_KEY;
    if (!secret) {
      return res.status(500).json({ error: 'SSO secret not configured' });
    }
    const pidRaw = req.query.pid;
    const pid = Number(pidRaw);
    if (!pid || !Number.isFinite(pid) || pid <= 0) {
      return res.status(400).json({ error: 'Invalid or missing pid' });
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 300; // 5 minutes

    const payload = { pid, iat: now, exp };
    const token = jwt.sign(payload, secret, { algorithm: 'HS256' });

    return res.json({ token });
  } catch (err) {
    console.error('php-token error:', err);
    return res.status(500).json({ error: 'Failed to create SSO token' });
  }
});

module.exports = router;
