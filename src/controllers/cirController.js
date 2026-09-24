const cirService = require('../services/cirService');
const { getConnectionStatus, getPool } = require('../config/db');
const XLSX = require('xlsx');

async function getCIRReport(req, res) {
  try {
    const filters = {
      companyId: req.query.companyId,
      terminalId: req.query.terminalId,
      financialYear: req.query.financialYear,
      size: req.query.size,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      contNo: req.query.contNo,
      blNo: req.query.blNo,
      tripType: req.query.tripType,
      customerId: req.query.customerId,
      serviceId: req.query.serviceId,
      search: req.query.search,
      ...req.query
    };

    const result = await cirService.getCIRReport(filters);
    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('MSSQL live fetch delayed/failed, loading snapshot data:', err.message);
    const fallback = cirService.getFallbackCIRReport(req.query);
    return res.json({
      success: true,
      source: 'SNAPSHOT_BACKUP',
      ...fallback,
    });
  }
}

async function getFinancialAnalytics(req, res) {
  try {
    const result = await cirService.getFinancialAnalytics();
    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Error fetching financial analytics, loading fallback:', err.message);
    const fallback = cirService.getFallbackFinancialAnalytics();
    return res.json({
      success: true,
      source: 'SNAPSHOT_BACKUP',
      data: fallback
    });
  }
}

async function getContainers(req, res) {
  try {
    const filters = {
      search: req.query.search,
      status: req.query.status,
      terminalId: req.query.terminalId,
      financialYear: req.query.financialYear,
      contSize: req.query.contSize || req.query.size,
      contType: req.query.contType,
      ...req.query
    };
    const result = await cirService.getContainersTracking(filters);
    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Error fetching containers, loading fallback:', err.message);
    const fallback = cirService.getFallbackContainers(req.query);
    return res.json({
      success: true,
      source: 'SNAPSHOT_BACKUP',
      data: fallback
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
    let connected = false;
    let details = null;
    try {
      await getPool();
      connected = true;
    } catch (e) {
      connected = false;
      details = e.message;
    }

    return res.json({
      status: 'online',
      db: {
        ...getConnectionStatus(),
        connected,
        details,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      error: err.message,
    });
  }
}

async function exportExcel(req, res) {
  try {
    const filters = {
      companyId: req.query.companyId,
      terminalId: req.query.terminalId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      contNo: req.query.contNo,
      blNo: req.query.blNo,
      tripType: req.query.tripType,
      customerId: req.query.customerId,
      serviceId: req.query.serviceId,
      search: req.query.search,
    };

    const result = await cirService.getCIRReport(filters);
    const data = result.records || [];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SPJ_Live_CIR_Report');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="SPJ_Live_CIR_Report.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to export Excel report',
      error: err.message,
    });
  }
}

async function syncWarehouse(req, res) {
  const dataWarehouseService = require('../services/dataWarehouseService');
  try {
    const result = await dataWarehouseService.syncLiveOracle();
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
