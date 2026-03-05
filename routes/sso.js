const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { userAuth } = require('../middlewares/auth');
const { get_report_encounter_id } = require('../models/auth');
require('dotenv').config();

// Issues a short-lived JWT for the legacy PHP app to consume at /session/sso_login
// GET /api/sso/php-token (requires auth; uses logged-in user's patient_id so the correct report is shown)
// Returns: { token }
router.get('/php-token', userAuth, async (req, res) => {
  try {
    const secret = process.env.CAREONE_PHP_SSO_SECRET || process.env.JWT_SECRET_KEY;
    if (!secret) {
      return res.status(500).json({ error: 'SSO secret not configured' });
    }
    // Use the authenticated user's patient_id so the portal always shows this user's report
    const pid = req.user && req.user.patient_id ? Number(req.user.patient_id) : 0;
    if (!pid || !Number.isFinite(pid) || pid <= 0) {
      return res.status(400).json({ error: 'Invalid or missing patient_id for current user' });
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

// GET /api/sso/report-encounter — Encounter_ID for the patient's latest HRA report (same as portal generate_report/ID)
// Used so the Personal Report opens the same report as encounter/generate_report/Encounter_ID on the portal.
router.get('/report-encounter', userAuth, async (req, res) => {
  try {
    const patient_id = req.user && req.user.patient_id ? Number(req.user.patient_id) : 0;
    if (!patient_id) {
      return res.status(400).json({ error: 'Invalid patient_id for current user' });
    }
    const encounter_id = await get_report_encounter_id(patient_id);
    return res.json({ encounter_id: encounter_id || null });
  } catch (err) {
    console.error('report-encounter error:', err);
    return res.status(500).json({ error: 'Failed to get report encounter' });
  }
});

module.exports = router;
