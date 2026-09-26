const cirService = require('../services/cirService');
const { getConnectionStatus, getPool } = require('../config/db');
const { normalizeAnalyticsFilters } = require('../utils/dateUtils');
const XLSX = require('xlsx');

async function getCIRReport(req, res) {
  try {
    const filters = normalizeAnalyticsFilters(req.query);
    if (filters.error) {
      return res.status(400).json({ success: false, error: filters.error });
    }

    const result = await cirService.getCIRReport(filters);
    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('Error executing CIR Report query:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch CIR report: ' + err.message
    });
  }
}

async function getFinancialAnalytics(req, res) {
  try {
    const filters = normalizeAnalyticsFilters(req.query);
    if (filters.error) {
      return res.status(400).json({ success: false, error: filters.error });
    }

    const result = await cirService.getFinancialAnalytics(filters);
    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Error fetching financial analytics:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate financial analytics: ' + err.message
    });
  }
}

async function getContainers(req, res) {
  try {
    const filters = normalizeAnalyticsFilters(req.query);
    if (filters.error) {
      return res.status(400).json({ success: false, error: filters.error });
    }

    const result = await cirService.getContainersTracking(filters);
    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Error fetching containers:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch containers: ' + err.message
    });
  }
}

async function getMasters(req, res) {
  try {
    const masters = await cirService.getMasters();
    return res.json({
      success: true,
      data: masters,
    });
  } catch (err) {
    console.error('Error fetching masters, loading fallback:', err.message);
    const fallback = cirService.getFallbackMasters();
    return res.json({
      success: true,
      source: 'SNAPSHOT_BACKUP',
      data: fallback,
    });
  }
}

async function getOperations(req, res) {
  try {
    const ops = await cirService.getOperationsSummary(req.query);
    return res.json({
      success: true,
      data: ops,
    });
  } catch (err) {
    console.error('Error fetching operations, loading fallback:', err.message);
    const fallback = cirService.getFallbackOperations(req.query);
    return res.json({
      success: true,
      source: 'SNAPSHOT_BACKUP',
      data: fallback,
    });
  }
}

async function getFleet(req, res) {
  try {
    const fleet = await cirService.getFleet(req.query);
    return res.json({
      success: true,
      data: fleet,
    });
  } catch (err) {
    console.error('Error fetching fleet, loading fallback:', err.message);
    return res.json({
      success: false,
      error: err.message,
    });
  }
}

async function checkHealth(req, res) {
  try {
    let dbConnected = false;
    try {
      const pool = await getPool();
      dbConnected = !!pool;
    } catch {
      dbConnected = false;
    }

    return res.json({
      status: 'online',
      services: {
        api: 'operational',
        dataWarehouse: 'operational',
        database: dbConnected ? 'connected' : 'offline',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
    });
  }
}

async function exportExcel(req, res) {
  try {
    const filters = normalizeAnalyticsFilters({ ...req.query, isExport: true });
    if (filters.error) {
      return res.status(400).json({ success: false, error: filters.error });
    }

    const result = await cirService.getCIRReport(filters);
    let data = result.records || [];

    // Excel Security Requirement: Enforce maximum export row cap to prevent memory amplification
    const MAX_EXPORT_ROWS = 2000;
    const totalRecordsFound = result.totalRecords || data.length;
    let isCapped = false;

    if (data.length > MAX_EXPORT_ROWS) {
      data = data.slice(0, MAX_EXPORT_ROWS);
      isCapped = true;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SPJ_Live_CIR_Report');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="SPJ_Live_CIR_Report.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('X-Total-Records', String(totalRecordsFound));
    res.setHeader('X-Export-Capped', isCapped ? 'true' : 'false');
    if (isCapped) {
      res.setHeader('X-Max-Allowed', String(MAX_EXPORT_ROWS));
    }
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to export Excel report',
    });
  }
}

async function syncWarehouse(req, res) {
  const dataWarehouseService = require('../services/dataWarehouseService');
  try {
    const result = await dataWarehouseService.syncLiveOracle();
    cirService.invalidateCache();
    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Live warehouse sync failed',
      error: err.message
    });
  }
}

async function getWarehouseStatus(req, res) {
  const dataWarehouseService = require('../services/dataWarehouseService');
  try {
    const status = dataWarehouseService.getStatus();
    return res.json({
      success: true,
      data: status
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

module.exports = {
  getCIRReport,
  getFinancialAnalytics,
  getContainers,
  getMasters,
  getFleet,
  getOperations,
  checkHealth,
  exportExcel,
  syncWarehouse,
  getWarehouseStatus,
};
