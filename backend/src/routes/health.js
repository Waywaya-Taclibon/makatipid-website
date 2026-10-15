const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => res.type('text').send('OK'));

module.exports = router;
