/**
 * Container Fleet & Yard Tracking Service with In-Memory Caching & Server-Side Pagination
 */
const fs = require('fs');
const path = require('path');
const { sanitizeSearchQuery, getRecordFinancialYear } = require('../utils/dateUtils');

let memoryContainers = null;
let memoryDetailed = null;

// Async initial load
function getContainersData() {
  if (memoryContainers) return memoryContainers;
  const contPath = path.join(__dirname, '../data/containers.json');
  try {
    if (fs.existsSync(contPath)) {
      memoryContainers = JSON.parse(fs.readFileSync(contPath, 'utf8'));
    }
  } catch (err) {
    console.error('[ContainerService] Error loading containers.json:', err.message);
  }
  if (!memoryContainers) {
    memoryContainers = {
      totalDBJobs: 88361,
      totalDBContainers: 89245,
      totalDBTeus: 171976,
      units20ft: 6508,
      units40ft: 82734,
      containers: []
    };
  }
  return memoryContainers;
}

function getDetailedData() {
  if (memoryDetailed) return memoryDetailed;
  const detailedPath = path.join(__dirname, '../data/branchAnalyticsDetailed.json');
  try {
    if (fs.existsSync(detailedPath)) {
      memoryDetailed = JSON.parse(fs.readFileSync(detailedPath, 'utf8'));
    }
  } catch (err) {
    console.error('[ContainerService] Error loading branchAnalyticsDetailed.json:', err.message);
  }
  return memoryDetailed;
}

/**
 * Clear cached container data on reload/sync
 */
function invalidateContainerCache() {
  memoryContainers = null;
  memoryDetailed = null;
}

/**
 * Fetch Full Container Fleet & Yard Tracking Live with Server-Side Pagination
 */
async function getContainersTracking(filters = {}) {
  const { search, terminalId, contSize, contType, status, financialYear, companyId, customerId } = filters;
  const contData = getContainersData();
  const detailed = getDetailedData();

  let rows = contData.containers || [];

  // Company Filter
  if (companyId && companyId !== 'all' && companyId !== 'ALL') {
    const compStr = companyId.toString().toLowerCase();
    rows = rows.filter(r => 
      (r.companyId && r.companyId.toString().toLowerCase() === compStr) ||
      (r.company && r.company.toLowerCase().includes(compStr))
    );
  }

  // Customer Filter
  if (customerId && customerId !== 'all' && customerId !== 'ALL') {
    const custStr = customerId.toString().toLowerCase();
    rows = rows.filter(r => 
      (r.customerId && r.customerId.toString().toLowerCase() === custStr) ||
      (r.customerName && r.customerName.toLowerCase().includes(custStr))
    );
  }

  // 1. Terminal Filter
  if (terminalId && terminalId !== 'all' && terminalId !== 'ALL') {
    const termStr = terminalId.toString().toLowerCase();
    rows = rows.filter(r => 
      (r.terminalId && r.terminalId.toString().toLowerCase() === termStr) ||
      (r.terminalName && r.terminalName.toLowerCase().includes(termStr))
    );
  }

  // 2. Financial Year Filter (using robust date parser)
  if (financialYear && financialYear !== 'all' && financialYear !== 'ALL') {
    rows = rows.filter(r => {
      const recFY = getRecordFinancialYear({
        INVOICE_DATE: r.joDate || r.icdInDate,
        INVOICE_REF_NO: r.bookingNo || r.joNo,
      });
      return recFY === financialYear;
    });
  }

  // 3. Size Filter (20 / 40)
  if (contSize && contSize !== 'all' && contSize !== 'ALL') {
    const targetSize = String(contSize).replace(/[^0-9]/g, '');
    rows = rows.filter(r => String(r.contSize || '').replace(/[^0-9]/g, '') === targetSize);
  }

  // 4. Container Type Filter (Reefer vs Dry Cargo)
  if (contType && contType !== 'all' && contType !== 'ALL') {
    const ctUpper = String(contType).toUpperCase();
    if (ctUpper === 'REEFER' || ctUpper === 'RF') {
      rows = rows.filter(r => {
        const t = String(r.contType || '').toUpperCase();
        return t.includes('RF') || t.includes('REEFER');
      });
    } else if (ctUpper === 'DRY' || ctUpper === 'GP') {
      rows = rows.filter(r => {
        const t = String(r.contType || '').toUpperCase();
        return t.includes('DRY') || t.includes('GP') || t.includes('HC');
      });
    } else {
      const ctLower = contType.toLowerCase();
      rows = rows.filter(r => String(r.contType || '').toLowerCase().includes(ctLower));
    }
  }

  // 5. Status Filter (In Chamber / Cold Storage vs Dispatched / Gate Out)
  if (status && status !== 'all' && status !== 'ALL') {
    const stUpper = String(status).toUpperCase();
    if (stUpper.includes('CHAMBER') || stUpper.includes('COLD')) {
      rows = rows.filter(r => {
        const s = String(r.status || '').toUpperCase();
        return s.includes('CHAMBER') || s.includes('COLD') || s.includes('YARD') || s.includes('ACTIVE') || s.includes('BUFFER');
      });
    } else if (stUpper.includes('DISPATCH') || stUpper.includes('GATE OUT') || stUpper.includes('OUTWARD')) {
      rows = rows.filter(r => {
        const s = String(r.status || '').toUpperCase();
        return s.includes('DISPATCH') || s.includes('GATE OUT') || s.includes('OUTWARD');
      });
    } else {
      const stLower = status.toLowerCase();
      rows = rows.filter(r => String(r.status || '').toLowerCase().includes(stLower));
    }
  }

  // 6. Search Filter
  const cleanSearch = sanitizeSearchQuery(search);
  if (cleanSearch) {
    const s = cleanSearch;
    rows = rows.filter(r => (
      (r.contNo && r.contNo.toLowerCase().includes(s)) ||
      (r.joNo && r.joNo.toLowerCase().includes(s)) ||
      (r.customerName && r.customerName.toLowerCase().includes(s)) ||
      (r.lineOperator && r.lineOperator.toLowerCase().includes(s)) ||
      (r.bookingNo && r.bookingNo.toLowerCase().includes(s)) ||
      (r.sealNo && r.sealNo.toLowerCase().includes(s)) ||
      (r.terminalName && r.terminalName.toLowerCase().includes(s))
    ));
  }

  const hasTerm = terminalId && terminalId !== 'ALL' && terminalId !== 'all';
  const hasFY = financialYear && financialYear !== 'ALL' && financialYear !== 'all';

  let totalDBJobs = contData.totalDBJobs || 88361;
  let totalDBContainers = contData.totalDBContainers || 89245;
  let totalDBTeus = contData.totalDBTeus || 171976;
  let units20ft = contData.units20ft || 6508;
  let units40ft = contData.units40ft || 82734;

  let targetTermId = null;
  if (hasTerm) {
    if (!isNaN(Number(terminalId))) {
      targetTermId = Number(terminalId);
    } else {
      const cleanTerm = String(terminalId).toLowerCase().replace(/[^a-z0-9]/g, '');
      const found = detailed?.terminals?.find(t => {
        const tClean = t.terminalName.toLowerCase().replace(/[^a-z0-9]/g, '');
        return tClean.includes(cleanTerm) || cleanTerm.includes(tClean);
      });
      if (found) targetTermId = found.terminalId;
    }
  }

  if (detailed) {
    if (hasTerm && hasFY && targetTermId) {
      const cell = detailed.terminalFyMatrix?.find(m => 
        m.terminalId === targetTermId && m.fy === financialYear
      );
      if (cell) {
        totalDBJobs = cell.totalJobs;
        totalDBContainers = cell.totalContainers;
        totalDBTeus = cell.teus;
        units20ft = cell.units20ft;
        units40ft = cell.units40ft;
      }
    } else if (hasFY && !hasTerm) {
      const fySum = detailed.fySummaries?.[financialYear];
      if (fySum) {
        totalDBJobs = fySum.totalJobs;
        totalDBContainers = fySum.totalContainers;
        totalDBTeus = fySum.teus;
        units20ft = fySum.units20ft;
        units40ft = fySum.units40ft;
      }
    } else if (hasTerm && !hasFY && targetTermId) {
      const tSum = detailed.terminals?.find(t => t.terminalId === targetTermId);
      if (tSum) {
        totalDBJobs = tSum.totalJobs;
        totalDBContainers = tSum.totalContainers;
        totalDBTeus = tSum.teus;
        units20ft = tSum.units20ft;
        units40ft = tSum.units40ft;
      }
    }
  }

  // Calculate stats on the FULL filtered dataset
  const inYardCount = rows.filter(r => r.status && (r.status.includes('Active') || r.status.includes('Yard') || r.status.includes('Chamber'))).length;
  const dispatchedCount = rows.filter(r => r.status && (r.status.includes('Dispatched') || r.status.includes('Outward'))).length;
  const jobRegisteredCount = rows.filter(r => r.status && r.status.includes('Registered')).length;

  const totalMatchingRecords = rows.length;

  // Server-Side Pagination: default page = 1, default limit = 25, max 100
  let page = parseInt(filters.page, 10);
  if (isNaN(page) || page < 1) page = 1;
  let limit = parseInt(filters.limit, 10);
  if (isNaN(limit) || limit < 1) limit = 25;
  if (limit > 100) limit = 100;

  const totalPages = Math.ceil(totalMatchingRecords / limit) || 1;
  if (page > totalPages && totalPages > 0) {
    page = totalPages;
  }

  const startIndex = (page - 1) * limit;
  const paginatedContainers = rows.slice(startIndex, startIndex + limit);

  return {
    total: (hasTerm || hasFY) ? totalDBContainers : totalMatchingRecords,
    totalRecords: totalMatchingRecords,
    page,
    limit,
    totalPages,
    count: paginatedContainers.length,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    stats: {
      totalDBJobs,
      totalDBContainers,
      totalDBTeus,
      units20ft,
      units40ft,
      filteredContainers: totalMatchingRecords,
      inYard: inYardCount,
      dispatched: dispatchedCount,
      registered: jobRegisteredCount
    },
    containers: paginatedContainers
  };
}

module.exports = {
  getContainersTracking,
  invalidateContainerCache,
};
