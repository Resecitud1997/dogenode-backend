const express = require('express');
const router = express.Router();
const db = require('..databasedb');

 Health check endpoint
router.get('', (req, res) = {
  const stats = db.getStats();
  
  res.json({
    success true,
    status 'healthy',
    uptime process.uptime(),
    timestamp new Date().toISOString(),
    stats stats,
    environment process.env.NODE_ENV  'development'
  });
});

module.exports = router;