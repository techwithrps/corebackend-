const path = require('path');
const fs = require('fs');
const { getRecordFinancialYear, sanitizeSearchQuery, parseDateToObj, normalizeAnalyticsFilters } = require('../utils/dateUtils');

let companyMastersData = null;
function getCompanyMasters() {
  if (!companyMastersData) {
    try {
      const p = path.join(__dirname, '../data/companyMasters.json');
      if (fs.existsSync(p)) {
        companyMastersData = JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch (e) {}
  }
  return companyMastersData;
}

/**
 * Filter CIR rows based on normalized request criteria
 * 100% Conjunctive (AND) Predicate Filter Engine
 */
function filterCIRRows(rows = [], inputFilters = {}) {
  const norm = inputFilters.fromDateObj !== undefined 
    ? inputFilters 
    : normalizeAnalyticsFilters(inputFilters);

  const {
    companyId,
    terminalId,
    financialYear,
    fromDateObj,
    toDateExclusive,
    toDateInclusiveObj,
    size,
    tripType,
    customerId,
    serviceId,
    contNo,
    blNo,
    search,
  } = norm;

  const hasCompany = !!companyId;
  const hasTerminal = !!terminalId;
  const hasCustomer = !!customerId;
  const hasService = !!serviceId;
  const hasTrip = !!tripType;
  const hasSize = !!size;
  const cleanContNo = contNo ? sanitizeSearchQuery(contNo) : null;
  const cleanBlNo = blNo ? sanitizeSearchQuery(blNo) : null;
  const cleanSearch = search ? sanitizeSearchQuery(search) : null;

  const targetSizeNum = hasSize ? String(size).replace(/[^0-9]/g, '') : null;
  const targetTripLower = hasTrip ? tripType.toLowerCase() : null;

  const termLower = hasTerminal ? terminalId.toString().toLowerCase() : null;
  const custLower = hasCustomer ? customerId.toString().toLowerCase() : null;
  const servLower = hasService ? serviceId.toString().toLowerCase() : null;

  // Resolve target company metadata
  let targetCompanyId = null;
  let targetCompanyCusts = null;
  let targetCompanyTerms = null;

  if (hasCompany) {
    const raw = String(companyId).toUpperCase().trim();
    if (raw === '3' || raw === 'PJ-OLD' || raw.includes('OLD')) targetCompanyId = 3;
    else if (raw === '2' || raw === 'SPJ') targetCompanyId = 2;
    else if (raw === '1' || raw === 'SJ') targetCompanyId = 1;
    else if (raw === '5' || raw === 'PJ') targetCompanyId = 5;
    else if (raw === '4' || raw === 'SPJ-MUM' || raw.includes('MUMBAI')) targetCompanyId = 4;
    else targetCompanyId = Number(companyId) || null;

    if (targetCompanyId) {
      const cm = getCompanyMasters();
      if (cm) {
        if (cm.companyCustomers && cm.companyCustomers[targetCompanyId]) {
          targetCompanyCusts = new Set(cm.companyCustomers[targetCompanyId].map(c => c.name.toLowerCase()));
        }
        if (cm.companyTerminals && cm.companyTerminals[targetCompanyId]) {
          targetCompanyTerms = new Set(cm.companyTerminals[targetCompanyId].map(t => Number(t.terminalId)));
        }
      }
    }
  }

  return rows.filter(item => {
    // 1. Company Filter
    if (hasCompany) {
      if (item.COMPANY_ID) {
        if (Number(item.COMPANY_ID) !== targetCompanyId) return false;
      } else {
        const cName = (item.CUSTOMER_NAME || '').toLowerCase();
        const tId = Number(item.TERMINAL_ID);
        const custMatch = targetCompanyCusts ? targetCompanyCusts.has(cName) : false;

        if (targetCompanyId === 4) { // SPJ Mumbai requires Mumbai terminal or customer
          if (!([5, 54].includes(tId) || (item.TERMINAL_NAME && item.TERMINAL_NAME.includes('NHAVA')) || custMatch)) {
            return false;
          }
        } else if (!custMatch) {
          return false;
        }
      }
    }

    // 2. Terminal Filter (Handles ID or Name)
    if (hasTerminal) {
      const match = (item.TERMINAL_ID && item.TERMINAL_ID.toString().toLowerCase() === termLower) ||
                    (item.TERMINAL_NAME && item.TERMINAL_NAME.toLowerCase().includes(termLower));
      if (!match) return false;
    }

    // 3. Date Range & Financial Year Filter (Inclusive / Exclusive date boundary logic)
    if (fromDateObj || toDateExclusive || toDateInclusiveObj) {
      const dateCandidates = [
        item.INVOICE_DATE,
        item.CREATED_DATE,
        item.CREATED_ON,
        item.LINE_HANDOVER_DATE,
        item.joDate,
        item.icdInDate,
        item.GATE_IN_DATE,
      ];
      let recDateObj = null;
      for (const candidate of dateCandidates) {
        if (candidate) {
          recDateObj = parseDateToObj(String(candidate));
          if (recDateObj) break;
        }
      }
      if (recDateObj) {
        if (fromDateObj && recDateObj < fromDateObj) return false;
        if (toDateExclusive && recDateObj >= toDateExclusive) return false;
        else if (!toDateExclusive && toDateInclusiveObj && recDateObj > toDateInclusiveObj) return false;
      }
    } else if (financialYear && financialYear !== 'CUSTOM_RANGE' && financialYear !== 'Custom Date Range' && financialYear !== 'CUSTOM') {
      const recFY = getRecordFinancialYear(item);
      if (recFY !== financialYear) return false;
    }

    // 4. Customer Filter
    if (hasCustomer) {
      const match = (item.CUSTOMER_ID && item.CUSTOMER_ID.toString() === custLower) ||
                    (item.CUSTOMER_NAME && item.CUSTOMER_NAME.toLowerCase().includes(custLower));
      if (!match) return false;
    }

    // 5. Service Filter
    if (hasService) {
      const match = (item.SERVICE_ID && item.SERVICE_ID.toString() === servLower) ||
                    (item.SERVICE_NAME && item.SERVICE_NAME.toLowerCase().includes(servLower));
      if (!match) return false;
    }

    // 6. Trip Type Filter
    if (hasTrip) {
      if (!item.TRIP_TYPE || item.TRIP_TYPE.toLowerCase() !== targetTripLower) return false;
    }

    // 7. Size Filter (20 / 40 / 45)
    if (hasSize) {
      const itemSize = String(item.CONT_SIZE || '').replace(/[^0-9]/g, '');
      if (itemSize !== targetSizeNum) return false;
    }

    // 8. Container No Substring
    if (cleanContNo) {
      if (!item.CONT_NO || !item.CONT_NO.toLowerCase().includes(cleanContNo)) return false;
    }

    // 9. BL / Bilty No Substring
    if (cleanBlNo) {
      const blMatch = (item.BL_NO && item.BL_NO.toLowerCase().includes(cleanBlNo)) ||
                      (item.PARTY_INV_NO && item.PARTY_INV_NO.toLowerCase().includes(cleanBlNo));
      if (!blMatch) return false;
    }

    // 10. Global Keyword Search (with length safety and ReDoS protection)
    if (cleanSearch) {
      const s = cleanSearch;
      const matched = (
        (item.CONT_NO && item.CONT_NO.toLowerCase().includes(s)) ||
        (item.BL_NO && item.BL_NO.toLowerCase().includes(s)) ||
        (item.CUSTOMER_NAME && item.CUSTOMER_NAME.toLowerCase().includes(s)) ||
        (item.INVOICE_REF_NO && item.INVOICE_REF_NO.toLowerCase().includes(s)) ||
        (item.INVOICE_NO && item.INVOICE_NO.toString().toLowerCase().includes(s)) ||
        (item.PARTY_INV_NO && item.PARTY_INV_NO.toLowerCase().includes(s)) ||
        (item.LINE && item.LINE.toLowerCase().includes(s)) ||
        (item.CFS && item.CFS.toLowerCase().includes(s)) ||
        (item.JOB_NO && item.JOB_NO.toString().toLowerCase().includes(s)) ||
        (item.SERVICE_NAME && item.SERVICE_NAME.toLowerCase().includes(s)) ||
        (item.INVOICE_NOTE && item.INVOICE_NOTE.toLowerCase().includes(s)) ||
        (item.PORT && item.PORT.toLowerCase().includes(s)) ||
        (item.TERMINAL_NAME && item.TERMINAL_NAME.toLowerCase().includes(s)) ||
        (item.LOCATION && item.LOCATION.toLowerCase().includes(s))
      );
      if (!matched) return false;
    }

    return true;
  });
}

function getRowTimestamp(item) {
  const dStr = item.INVOICE_DATE || item.DATE || item.createdOn || item.CREATED_ON;
  if (dStr) {
    const s = String(dStr).trim();
    const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (dmy) {
      return new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10), 12, 0, 0).getTime() || 0;
    }
    const t = new Date(s).getTime();
    if (!isNaN(t)) return t;
  }
  return Number(item.INVOICE_ID) || 0;
}

/**
 * Paginate rows safely
 * Rules: Default page = 1, default limit = 50, maximum limit = 100
 * Ensures latest records by actual database date are ALWAYS at the top.
 */
function paginateRows(rows, paginationParams = {}, isExport = false, maxExportLimit = 2000) {
  // Sort rows descending by actual database date & invoice ID
  const sortedRows = [...rows].sort((a, b) => {
    const tB = getRowTimestamp(b);
    const tA = getRowTimestamp(a);
    if (tB !== tA) return tB - tA;
    return (Number(b.INVOICE_ID) || 0) - (Number(a.INVOICE_ID) || 0);
  });

  const totalRecords = sortedRows.length;

  if (isExport) {
    const capped = sortedRows.slice(0, maxExportLimit);
    return {
      records: capped,
      page: 1,
      limit: maxExportLimit,
      totalRecords,
      totalPages: 1,
      count: capped.length,
      hasNextPage: false,
      hasPreviousPage: false,
      isExport: true,
      isCapped: totalRecords > maxExportLimit,
    };
  }

  let page = parseInt(paginationParams.page, 10);
  if (isNaN(page) || page < 1) page = 1;

  let limit = parseInt(paginationParams.limit, 10);
  if (isNaN(limit) || limit < 1) limit = 50;
  if (limit > 100) limit = 100; // Enforce maximum limit of 100

  const totalPages = Math.ceil(totalRecords / limit) || 1;
  if (page > totalPages && totalPages > 0) {
    page = totalPages;
  }

  const startIndex = (page - 1) * limit;
  const paginatedSlice = sortedRows.slice(startIndex, startIndex + limit);

  return {
    records: paginatedSlice,
    page,
    limit,
    totalRecords,
    totalPages,
    count: paginatedSlice.length,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

module.exports = {
  filterCIRRows,
  paginateRows,
  getRowTimestamp
};

