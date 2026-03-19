const express = require('express');
const { register } = require('../config/metrics');

const router = express.Router();

router.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).json({ error: { message: 'Failed to retrieve metrics' } });
  }
});

module.exports = router;
