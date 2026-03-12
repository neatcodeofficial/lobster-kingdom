const express = require('express');
const path = require('path');
const compression = require('compression');
const config = require('./config.json');
const apiRouter = require('./routes/api');

const app = express();
const PORT = config.port || 3995;

app.disable('x-powered-by');

// === Gzip compression (before other middleware) ===
app.use(compression({ threshold: 512 }));

// === Security headers ===
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// === Body parser ===
app.use(express.json({ limit: '100kb' }));

// === Health check (before static, so it always works) ===
app.get('/health', (req, res) => {
  const { getData } = require('./services/session-parser');
  const data = getData();
  res.json({
    ok: true,
    uptime: process.uptime(),
    memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
    lobsters: data ? data.stats.total : 0,
    timestamp: new Date().toISOString()
  });
});

// === Static files with cache ===
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true,
  setHeaders(res, filePath) {
    // No cache for HTML (always fresh)
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    // Long cache for versioned assets (?v=xx)
    if (filePath.match(/\.(png|svg|ico)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }
  }
}));

// === API routes ===
app.use('/api', apiRouter);

// === 404 handler ===
app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

// === Error handler ===
app.use((err, req, res, next) => {
  console.error('[server] Error:', err.message);
  res.status(500).json({ error: 'internal server error' });
});

// === Graceful shutdown ===
const server = app.listen(PORT, () => {
  console.log(`🦞 Lobster Kingdom running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('[server] SIGINT received, shutting down...');
  server.close(() => process.exit(0));
});
