const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const { getPool } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
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

app.listen(PORT, async () => {
  console.log(`=============================================`);
  console.log(`🚀 SPJ Cargo API running on http://localhost:${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/api/health`);
  console.log(`   CIR Data API: http://localhost:${PORT}/api/cir-report`);
  console.log(`=============================================`);
  
  // Try connecting to MSSQL on startup
  try {
    await getPool();
  } catch (err) {
    console.warn('MSSQL initial connection attempt:', err.message);
  }
});
