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
function queryOracleDatabase(filters = {}) {
  return new Promise((resolve, reject) => {
    const norm = normalizeAnalyticsFilters(filters);
    if (norm.error) {
      return reject(new Error(norm.error));
    }

    const mode = filters.mode || 'invoice';

    const args = [
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
    if (norm.tripType) args.push(`tripType=${norm.tripType}`);
    if (norm.size) args.push(`size=${norm.size}`);
    if (norm.contNo) args.push(`contNo=${norm.contNo}`);
    if (norm.blNo) args.push(`blNo=${norm.blNo}`);
    if (norm.search) args.push(`search=${norm.search}`);
    if (norm.page) args.push(`page=${norm.page}`);
    if (norm.limit) args.push(`limit=${norm.limit}`);

    const startTime = Date.now();

    execFile('java', args, { cwd: TOOLS_ORACLE_DIR, maxBuffer: 50 * 1024 * 1024, timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
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
  });
}

module.exports = {
  queryOracleDatabase
};
