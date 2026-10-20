const express = require('express');
const { checkConnection } = require('../db');

const router = express.Router();

// Liveness: proves the Node process is up. Deliberately DB-free so it stays
// cheap for external keep-alive pings (Render free tier spins down after 15
// minutes without inbound traffic).
router.get('/health', (req, res) => res.type('text').send('OK'));

// Readiness: also proves the pool can hand out a working MySQL/TiDB
// connection. Point a slower monitor at this one.
router.get('/health/db', async (req, res) => {
  try {
    await checkConnection();
    return res.type('text').send('OK');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Database health check failed:', err.message);
    return res.status(503).type('text').send('DB unavailable');
  }
});

module.exports = router;
