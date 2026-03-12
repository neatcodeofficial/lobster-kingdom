const express = require('express');
const router = express.Router();
const { getData } = require('../services/session-parser');

// Rate limit: max 1 request per second per IP
const rateMap = new Map();
const RATE_LIMIT_MS = 1000;

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const last = rateMap.get(ip) || 0;
  if (now - last < RATE_LIMIT_MS) {
    return res.status(429).json({ error: 'too many requests' });
  }
  rateMap.set(ip, now);
  // Clean old entries periodically
  if (rateMap.size > 100) {
    for (const [k, v] of rateMap) {
      if (now - v > 60000) rateMap.delete(k);
    }
  }
  next();
}

router.get('/lobsters', rateLimit, (req, res) => {
  try {
    const data = getData();
    if (!data) {
      return res.status(503).json({ error: 'data not ready' });
    }
    
    // Optional filtering
    const { zone, level, search, limit } = req.query;
    let lobsters = data.lobsters;
    
    if (zone && ['working', 'resting', 'idle'].includes(zone)) {
      lobsters = lobsters.filter(l => l.zone === zone);
    }
    if (level !== undefined) {
      const lv = parseInt(level);
      if (lv >= 0 && lv <= 5) {
        lobsters = lobsters.filter(l => l.level === lv);
      }
    }
    if (search && typeof search === 'string' && search.length <= 50) {
      const q = search.toLowerCase();
      lobsters = lobsters.filter(l => l.name.toLowerCase().includes(q));
    }
    if (limit) {
      const n = parseInt(limit);
      if (n > 0 && n <= 500) {
        lobsters = lobsters.slice(0, n);
      }
    }
    
    res.json({ lobsters, stats: data.stats });
  } catch (e) {
    console.error('[api] /lobsters error:', e.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// Stats-only endpoint (lightweight)
router.get('/stats', (req, res) => {
  try {
    const data = getData();
    if (!data) return res.status(503).json({ error: 'data not ready' });
    res.json(data.stats);
  } catch (e) {
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
