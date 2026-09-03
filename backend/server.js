require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const initDb = require('./src/config/initDb');
const routes = require('./src/routes');
const errorHandler = require('./src/middlewares/errorHandler');

const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

// Enforce HTTPS in production via reverse-proxy header
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (!isHttps) {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Security headers (disable strict CSP to allow Vite bundled assets)
app.use(helmet({ contentSecurityPolicy: false }));

// CORS configuration (support both local dev and public tunnel domains)
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
}));

// Body parsing
app.use(express.json());

// Logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', routes);

// 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: `API route ${req.method} ${req.originalUrl} not found` });
});

// Serve frontend SPA bundle if built
const frontendDist = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Global error handler (must be registered last)
app.use(errorHandler);

const startServer = async () => {
  try {
    // Initialize database schema on startup before listening
    await initDb();
    console.log('Database initialized.');

    app.listen(PORT, () => {
      console.log(`Backend server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (error) {
    console.error('Failed to start server due to database or startup error:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
