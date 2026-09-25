/**
 * Enterprise Date & Fiscal Year Utilities for SPJ Logistics
 * Standard Indian Fiscal Year: April 1 to March 31
 */

/**
 * Safely parse date into { day, month, year } where month is 1-12
 */
function parseDateParts(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'null' || trimmed === 'undefined') return null;

  // Format 1: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return { day, month, year };
    }
  }

  // Format 2: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return { day, month, year };
    }
  }

  // Fallback: Date.parse
  const timestamp = Date.parse(trimmed);
  if (!isNaN(timestamp)) {
    const d = new Date(timestamp);
    return {
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    };
  }

  return null;
}

/**
 * Determine Indian Financial Year label (e.g., 'FY 2024-25', 'FY 2025-26')
 * Rule: April 1 of year Y to March 31 of year Y+1 belongs to FY Y-(Y+1)
 */
function getIndianFiscalYear(year, month) {
  if (!year || !month) return 'FY 2022-23 & Earlier';

  let startYear;
  if (month >= 4) {
    // April to December
    startYear = year;
  } else {
    // January to March belongs to previous year's FY
    startYear = year - 1;
  }

  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  const fyLabel = `FY ${startYear}-${endYearShort}`;

  // Standardize with known system financial years
  if (fyLabel === 'FY 2026-27') return 'FY 2026-27';
  if (fyLabel === 'FY 2025-26') return 'FY 2025-26';
  if (fyLabel === 'FY 2024-25') return 'FY 2024-25';
  if (fyLabel === 'FY 2023-24') return 'FY 2023-24';
  if (startYear <= 2022) return 'FY 2022-23 & Earlier';

  return fyLabel;
}

/**
 * Extract fiscal year from record, prioritizing explicit invoice reference conventions
 * and falling back to robust date-boundary parsing.
 */
function getRecordFinancialYear(record) {
  if (!record) return 'FY 2022-23 & Earlier';

  // 1. Check primary transaction dates with exact April-March boundary handling
  const dateCandidates = [
    record.INVOICE_DATE,
    record.CREATED_DATE,
    record.CREATED_ON,
    record.LINE_HANDOVER_DATE,
    record.joDate,
    record.icdInDate,
    record.GATE_IN_DATE,
  ];

  for (const candidate of dateCandidates) {
    if (candidate) {
      const parts = parseDateParts(String(candidate));
      if (parts) {
        return getIndianFiscalYear(parts.year, parts.month);
      }
    }
  }

  // 2. Fallback to explicit invoice reference notation if date is missing or unparseable
  const invRef = String(record.INVOICE_REF_NO || record.PARTY_INV_NO || '');
  if (invRef) {
    if (invRef.includes('26-27') || invRef.includes('/26-27') || invRef.includes('-26-27')) return 'FY 2026-27';
    if (invRef.includes('25-26') || invRef.includes('/25-26') || invRef.includes('-25-26')) return 'FY 2025-26';
    if (invRef.includes('24-25') || invRef.includes('/24-25') || invRef.includes('-24-25')) return 'FY 2024-25';
    if (invRef.includes('23-24') || invRef.includes('/23-24') || invRef.includes('-23-24')) return 'FY 2023-24';
    if (invRef.includes('22-23') || invRef.includes('21-22') || invRef.includes('20-21')) return 'FY 2022-23 & Earlier';
  }

  return 'FY 2022-23 & Earlier';
}

/**
 * Safe search string sanitizer preventing ReDoS and excessive memory allocation
 */
function sanitizeSearchQuery(query, maxLength = 80) {
  if (!query || typeof query !== 'string') return '';
  const trimmed = query.trim().slice(0, maxLength);
  return trimmed.toLowerCase();
}

module.exports = {
  parseDateParts,
  getIndianFiscalYear,
  getRecordFinancialYear,
  sanitizeSearchQuery,
};
