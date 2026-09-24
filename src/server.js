const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5001;

app.disable('x-powered-by');

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const allowedOrigins = [
  'https://spj-mauve.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5001',
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow server-to-server / curl
    const isAllowed = allowedOrigins.some(
      allowed => allowed === origin || (allowed.endsWith('.vercel.app') && origin.endsWith('.vercel.app'))
    );
    if (isAllowed) return callback(null, true);
    return callback(new Error('CORS policy: Not allowed by Access-Control-Allow-Origin.'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'x-admin-key'],
};

app.use(cors(corsOptions));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Mount API routes
app.use('/api', apiRoutes);

// Root health
app.get('/', (req, res) => {
  res.json({
    name: 'SPJ Cargo Intelligence & CIR API',
    status: 'operational',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 SPJ Cargo API running on http://localhost:${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/api/health`);
  console.log(`   CIR Data API: http://localhost:${PORT}/api/cir-report`);
  console.log(`=============================================`);
});
