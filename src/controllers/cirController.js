const cirService = require('../services/cirService');
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

const cirAnalyticsService = require('../services/cirAnalyticsService');

async function getFinancialAnalytics(req, res) {
  try {
    const filters = normalizeAnalyticsFilters(req.query);
    if (filters.error) {
      return res.status(400).json({ success: false, error: filters.error });
    }

    const result = await cirAnalyticsService.getFinancialAnalytics(filters);
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
    // Oracle SPJLIVE is the single source of truth.
    // Verify Oracle connectivity via the data warehouse snapshot.
    let dbConnected = false;
    try {
      const warehouse = require('../services/dataWarehouseService').getWarehouse();
      dbConnected = !!(warehouse && warehouse.allTimeGrandTotals);
    } catch {
      dbConnected = false;
    }

    return res.json({
      status: 'online',
      services: {
        api: 'operational',
        dataWarehouse: 'operational',
        database: dbConnected ? 'connected' : 'offline',
        databaseEngine: 'ORACLE_SPJLIVE',
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

    const result = await cirService.getCIRReport({ ...filters, isExport: true, page: 1, limit: 100000 });
    let rawRecords = result.records || [];

    const formattedExport = rawRecords.map((r, idx) => {
      const billAmt = Number(r.BILL_AMOUNT || 0);
      const taxAmt = Number(r.TAX_AMOUNT || r.TAX || 0);
      const totalAmt = Number(r.TOTAL_AMOUNT || r.AMOUNT || (billAmt + taxAmt));
      const igst = Number(r.IGST || 0);
      const cgst = Number(r.CGST || 0);
      const sgst = Number(r.SGST || 0);

      return {
        'Sr. No': idx + 1,
        'Customer': r.CUSTOMER_NAME || '',
        'Shipper Inv No.': r.PARTY_INV_NO || r.CLIENT_INVOICE_NO || '',
        'BL No': r.BL_NO || '',
        'Handover Date': r.LINE_HANDOVER_DATE || r.INVOICE_DATE || '',
        'SOB Date': r.SAILED || r.INVOICE_DATE || '',
        'POD': r.PORT || r.TERMINAL_NAME || '',
        'Invoice No': r.INVOICE_REF_NO || r.INVOICE_NO || '',
        'Invoice Date': r.INVOICE_DATE || '',
        'Service Type': r.SERVICE_NAME || r.SERVICE_TYPE || '',
        'Ex Rate': r.BILL_QNTY || 1,
        'Amount': billAmt,
        'IGST': igst,
        'CGST': cgst,
        'SGST': sgst,
        'Total': totalAmt
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoice_Report_New');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Invoice_Report_New_SPJ.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('X-Total-Records', String(formattedExport.length));
    return res.send(buffer);
  } catch (err) {
    console.error('exportExcel Error:', err);
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

async function getVesselSchedules(req, res) {
  const vesselService = require('../services/vesselService');
  try {
    const result = await vesselService.getVesselSchedules(req.query);
    return res.json(result);
  } catch (err) {
    console.error('Error fetching vessel schedules:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function getVesselConfig(req, res) {
  const vesselService = require('../services/vesselService');
  try {
    const config = vesselService.getVesselConfig();
    return res.json({ success: true, config });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function saveVesselConfig(req, res) {
  const vesselService = require('../services/vesselService');
  try {
    const updated = vesselService.saveVesselConfig(req.body);
    return res.json({ success: true, message: 'Vessel API configuration saved successfully', config: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function getMovementHistory(req, res) {
  try {
    const { queryOracleDatabase } = require('../services/oracleDbService');
    const contNo = req.query.contNo || req.query.containerNo || req.query.search;
    
    // Server-side tenant isolation check
    const user = req.user;
    let customerFilter = null;
    if (user && user.role === 'customer' && user.tenantScope) {
      customerFilter = user.tenantScope.customerCode || user.tenantScope.customerName || user.tenantScope.customerId;
    }

    const result = await queryOracleDatabase({
      mode: 'movement-history',
      contNo: contNo,
      search: req.query.search || req.query.blNo || req.query.partyInvNo,
      customerId: customerFilter
    });

    // If customer is logged in, verify container ownership
    if (user && user.role === 'customer' && user.tenantScope && result && result.summary) {
      const allowedCode = (user.tenantScope.customerCode || '').toUpperCase();
      const allowedName = (user.tenantScope.customerName || '').toUpperCase();
      const partyInv = String(result.summary.partyInvNo || '').toUpperCase();
      const summaryCust = String(result.summary.customerName || '').toUpperCase();

      const isOwned = 
        (allowedCode && (partyInv.startsWith(allowedCode) || partyInv.includes(allowedCode))) ||
        (allowedName && summaryCust.includes(allowedName)) ||
        (summaryCust && allowedName.includes(summaryCust));

      if (!isOwned && partyInv) {
        return res.status(403).json({
          success: false,
          error: 'Access Denied: You are not authorized to track containers belonging to another customer account.'
        });
      }
    }

    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Error fetching movement history:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch movement history: ' + err.message
    });
  }
}

module.exports = {
  getCIRReport,
  getFinancialAnalytics,
  getContainers,
  getMovementHistory,
  getMasters,
  getFleet,
  getOperations,
  checkHealth,
  exportExcel,
  syncWarehouse,
  getWarehouseStatus,
  getVesselSchedules,
  getVesselConfig,
  saveVesselConfig,
};
