const path = require('path');
const { execFile } = require('child_process');
const { normalizeAnalyticsFilters } = require('../utils/dateUtils');

const TOOLS_ORACLE_DIR = path.resolve(__dirname, '../tools/oracle');
const JAR_PATH = path.join(TOOLS_ORACLE_DIR, 'ojdbc11.jar');
const CP_PATH = `${JAR_PATH}:${TOOLS_ORACLE_DIR}`;

/**
 * Execute dynamic real-time SQL queries directly on Oracle SPJLIVE database
 * with WHERE predicates evaluated inside Oracle DB itself.
 * Supports modes: invoice | containers | fleet | masters
 */
let executionQueue = Promise.resolve();

/**
 * Execute dynamic real-time SQL queries directly on Oracle SPJLIVE database
 * with WHERE predicates evaluated inside Oracle DB itself.
 * Serialized execution ensures Render 512MB container never runs out of memory,
 * with active signal-based abortion to eliminate orphaned hanging tasks.
 */
function queryOracleDatabase(filters = {}) {
  const task = () => new Promise((resolve, reject) => {
    // 1. If already aborted by client before entering execution queue, exit immediately
    if (filters.signal && filters.signal.aborted) {
      const err = new Error('Query aborted by client before execution');
      err.name = 'AbortError';
      return reject(err);
    }

    const norm = normalizeAnalyticsFilters(filters);
    if (norm.error) {
      return reject(new Error(norm.error));
    }

    const mode = filters.mode || 'invoice';

    const args = [
      '-Xmx160m',
      '-Xms32m',
      '-cp', CP_PATH,
      'OracleAnalyticsEngine',
      `mode=${mode}`
    ];

    const fromD = norm.fromDateStr || norm.fromDate;
    const toD = norm.toDateStr || norm.toDate;

    if (fromD) args.push(`fromDate=${fromD}`);
    if (toD) args.push(`toDate=${toD}`);
    if (norm.companyId) args.push(`companyId=${norm.companyId}`);
    if (norm.customerId) args.push(`customerId=${norm.customerId}`);
    if (norm.terminalId) args.push(`terminalId=${norm.terminalId}`);
    if (norm.serviceId) args.push(`serviceId=${norm.serviceId}`);
    if (norm.serviceType) args.push(`serviceType=${norm.serviceType}`);
    if (norm.tripType) args.push(`tripType=${norm.tripType}`);
    if (norm.size) args.push(`size=${norm.size}`);
    if (norm.contNo) args.push(`contNo=${norm.contNo}`);
    if (norm.blNo) args.push(`blNo=${norm.blNo}`);
    if (norm.search) args.push(`search=${norm.search}`);
    if (norm.page) args.push(`page=${norm.page}`);
    if (norm.limit) args.push(`limit=${norm.limit}`);

    const startTime = Date.now();
    let isSettled = false;

    const child = execFile('java', args, { cwd: TOOLS_ORACLE_DIR, maxBuffer: 50 * 1024 * 1024, timeout: 60000 }, (error, stdout, stderr) => {
      if (cleanupAbort) cleanupAbort();
      if (isSettled) return;
      isSettled = true;

      if (error) {
        if (filters.signal?.aborted || error.killed) {
          const abortErr = new Error('Query cancelled by client');
          abortErr.name = 'AbortError';
          return reject(abortErr);
        }
        console.error('[OracleDBService] Oracle execution error:', error.message, stderr);
        return reject(new Error('Oracle DB execution failed: ' + error.message));
      }

      try {
        const json = JSON.parse(stdout.trim());
        if (!json.success) {
          console.error('[OracleDBService] Oracle SQL Error:', json.error);
          return reject(new Error('Oracle DB error: ' + json.error));
        }

        resolve({
          ...json,
          nodeExecutionTimeMs: Date.now() - startTime
        });
      } catch (e) {
        console.error('[OracleDBService] Failed to parse Oracle JSON output:', stdout);
        reject(new Error('Invalid Oracle output format: ' + e.message));
      }
    });

    let cleanupAbort = null;
    if (filters.signal) {
      const abortListener = () => {
        if (isSettled) return;
        isSettled = true;
        try {
          child.kill('SIGTERM');
          setTimeout(() => {
            try { child.kill('SIGKILL'); } catch (e) {}
          }, 300);
        } catch (e) {}
        const err = new Error('Query aborted by client');
        err.name = 'AbortError';
        reject(err);
      };

      filters.signal.addEventListener('abort', abortListener, { once: true });
      cleanupAbort = () => {
        try {
          filters.signal.removeEventListener('abort', abortListener);
        } catch (e) {}
      };
    }
  });

  // Strict serialization queue guarantees only 1 JVM process runs at any instant
  // Preventing Render 512MB RAM container from ever running out of memory
  const next = executionQueue.then(task, task);
  executionQueue = next.catch(() => {});
  return next;
}

module.exports = {
  queryOracleDatabase
};
