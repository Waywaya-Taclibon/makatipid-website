const express = require('express');
const { isDemoEnabled, demoPhotos } = require('../demo');

const router = express.Router();

// Public: lets the UI decide whether to show the demo buttons at all, and which
// sample photos demo-created listings should use.
router.get('/config', (req, res) => {
  res.json({ demoLoginEnabled: isDemoEnabled(), demoPhotos: demoPhotos() });
});

module.exports = router;
