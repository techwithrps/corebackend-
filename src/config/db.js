const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'jqgiF@12345ZPK',
  server: process.env.DB_SERVER || '103.197.76.251',
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  database: process.env.DB_NAME || 'SPJ',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    connectTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 15000,
    requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT, 10) || 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;
let isConnected = false;
let lastError = null;

async function getPool() {
  if (pool && isConnected) return pool;
  try {
    console.log(`[MSSQL] Connecting to ${config.server}:${config.port}/${config.database}...`);
    pool = await sql.connect(config);
    isConnected = true;
    lastError = null;
    console.log('[MSSQL] Connection established successfully.');
    return pool;
  } catch (err) {
    isConnected = false;
    lastError = err.message;
    console.error('[MSSQL] Connection Error:', err.message);
    throw err;
  }
}

function getConnectionStatus() {
  return {
    connected: isConnected,
    host: config.server,
    port: config.port,
    database: config.database,
    user: config.user,
    error: lastError,
  };
}

module.exports = {
  sql,
  getPool,
  getConnectionStatus,
};
