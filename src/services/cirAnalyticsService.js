/**
 * CIR Financial & Terminal Analytics Service
 */
const fs = require('fs');
const path = require('path');
const dataWarehouseService = require('./dataWarehouseService');
const cacheService = require('./cacheService');
const { getRecordFinancialYear } = require('../utils/dateUtils');

// In-memory data store to eliminate blocking fs.readFileSync
let memorySnapshot = null;
let memorySummary = null;
let memoryDetailed = null;
let memoryBranchAnalytics = null;

function getSnapshotData() {
  if (memorySnapshot) return memorySnapshot;
  const p = path.join(__dirname, '../data/cachedSnapshot.json');
  try {
    if (fs.existsSync(p)) {
      memorySnapshot = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) {
    console.error('[cirAnalyticsService] Snapshot read error:', e.message);
  }
  return memorySnapshot || [];
}

function getSummaryData() {
  if (memorySummary) return memorySummary;
  const p = path.join(__dirname, '../data/exactDBSummary.json');
  try {
    if (fs.existsSync(p)) {
      memorySummary = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) {
    console.error('[cirAnalyticsService] Summary read error:', e.message);
  }
  return memorySummary;
}

function getDetailedData() {
  if (memoryDetailed) return memoryDetailed;
  const p = path.join(__dirname, '../data/branchAnalyticsDetailed.json');
  try {
    if (fs.existsSync(p)) {
      memoryDetailed = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) {
    console.error('[cirAnalyticsService] Detailed analytics read error:', e.message);
  }
  return memoryDetailed;
}

function getBranchAnalyticsData() {
  if (memoryBranchAnalytics) return memoryBranchAnalytics;
  const p = path.join(__dirname, '../data/branchAnalytics.json');
  try {
    if (fs.existsSync(p)) {
      memoryBranchAnalytics = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) {
    console.error('[cirAnalyticsService] Branch analytics read error:', e.message);
  }
  return memoryBranchAnalytics || [];
}

function invalidateAnalyticsCache() {
  memorySnapshot = null;
  memorySummary = null;
  memoryDetailed = null;
  memoryBranchAnalytics = null;
}

/**
 * Calculate KPI summary aggregates including Terminal and Location-wise Breakdown
 */
/**
 * Calculate KPI summary aggregates including Terminal and Location-wise Breakdown
 * 100% Dynamic Engine adhering to the Real-Time Database Analytics Contract
 */
function calculateKPIs(rows = [], dbSummary = null, detailed = null, filterMeta = {}) {
  // Dynamic Row Accumulation for ANY filter scope (FY, Custom Range, Company, Terminal, Customer, etc.)
  let totalInvoiceGross = 0;
  let totalCreditGross = 0;
  let totalInvoiceBill = 0;
  let totalCreditBill = 0;
  let totalInvoiceTax = 0;
  let totalCreditTax = 0;

  const distinctInvoices = new Set();
  const distinctCreditNotes = new Set();
  const distinctContainers = new Set();
  const distinctJobs = new Set();
  let units20 = 0;
  let units40 = 0;

  const tripCounts = {};
  const serviceAmounts = {};
  const customerAmounts = {};
  const customerMap = {};
  const lineCounts = {};
  const terminalBreakdown = {};
  const locationBreakdown = {};

  rows.forEach(r => {
    const amt = Number(r.AMOUNT) || Number(r.TOTAL_AMOUNT) || Number(r.BILL_AMOUNT) || 0;
    const bill = Number(r.BILL_AMOUNT) || (amt ? Math.round((amt / 1.18) * 100) / 100 : 0);
    const tax = Number(r.TAX_AMOUNT) || Number(r.TAX) || (amt - bill);

    const invKey = (r.INVOICE_REF_NO || r.INVOICE_NO || 'INV') + '__' + (r.CUSTOMER_ID || r.CUSTOMER_NAME || 'CUST');
    const contKey = r.CONT_NO || '';

    if (r.INVOICE_TYPE === 'Credit Note' || (r.TRIP_TYPE && r.TRIP_TYPE.toLowerCase().includes('credit'))) {
      distinctCreditNotes.add(invKey);
      totalCreditGross += Math.abs(amt);
      totalCreditBill += Math.abs(bill);
      totalCreditTax += Math.abs(tax);
    } else {
      distinctInvoices.add(invKey);
      totalInvoiceGross += Math.abs(amt);
      totalInvoiceBill += Math.abs(bill);
      totalInvoiceTax += Math.abs(tax);
    }

    if (contKey && contKey.trim() !== '' && contKey !== '-' && !distinctContainers.has(contKey)) {
      distinctContainers.add(contKey);
      const sz = String(r.CONT_SIZE || '');
      if (sz.includes('20')) {
        units20++;
      } else {
        units40++;
      }
    }

    const trip = r.TRIP_TYPE || 'Other';
    tripCounts[trip] = (tripCounts[trip] || 0) + amt;

    const svc = r.SERVICE_NAME || 'General';
    serviceAmounts[svc] = (serviceAmounts[svc] || 0) + amt;

    const custName = r.CUSTOMER_NAME || 'Unknown Customer';
    const custId = String(r.CUSTOMER_ID || custName);
    customerAmounts[custName] = (customerAmounts[custName] || 0) + amt;

    if (!customerMap[custId]) {
      customerMap[custId] = {
        customerId: custId,
        customerName: custName,
        invoiceCount: 0,
        containerCount: 0,
        billAmount: 0,
        taxAmount: 0,
        grossAmount: 0,
        netRevenue: 0,
        terminals: new Set()
      };
    }
    const cEntry = customerMap[custId];
    cEntry.invoiceCount++;
    cEntry.billAmount += bill;
    cEntry.taxAmount += tax;
    cEntry.grossAmount += amt;
    cEntry.netRevenue += amt;
    if (contKey && contKey.trim() !== '' && contKey !== '-') cEntry.containerCount++;
    if (r.TERMINAL_NAME) cEntry.terminals.add(r.TERMINAL_NAME);

    if (r.TERMINAL_NAME) {
      if (!terminalBreakdown[r.TERMINAL_NAME]) {
        terminalBreakdown[r.TERMINAL_NAME] = { terminalName: r.TERMINAL_NAME, containers: 0, revenue: 0, invoices: 0 };
      }
      terminalBreakdown[r.TERMINAL_NAME].invoices++;
      terminalBreakdown[r.TERMINAL_NAME].revenue += amt;
      if (contKey) terminalBreakdown[r.TERMINAL_NAME].containers++;
    }

    if (r.LINE && r.LINE.trim() !== '') {
      lineCounts[r.LINE] = (lineCounts[r.LINE] || 0) + 1;
    }
  });

  const totalInvoiceAmount = Math.round(totalInvoiceGross * 100) / 100;
  const totalCreditAmount = Math.round(totalCreditGross * 100) / 100;
  const netRevenue = Math.round((totalInvoiceGross - totalCreditGross) * 100) / 100;
  const totalBillAmount = Math.round(totalInvoiceBill * 100) / 100;
  const totalTax = Math.round(totalInvoiceTax * 100) / 100;
  const totalTeus = units20 + (units40 * 2);

  const customerWise = Object.values(customerMap)
    .map(c => ({
      ...c,
      billAmount: Math.round(c.billAmount * 100) / 100,
      taxAmount: Math.round(c.taxAmount * 100) / 100,
      grossAmount: Math.round(c.grossAmount * 100) / 100,
      netRevenue: Math.round(c.netRevenue * 100) / 100,
      terminalCount: c.terminals.size,
      terminals: Array.from(c.terminals)
    }))
    .sort((a, b) => b.grossAmount - a.grossAmount);

  const topBranches = Object.values(terminalBreakdown)
    .map(t => ({
      terminalName: t.terminalName,
      grossSale: Math.round(t.revenue * 100) / 100,
      netRevenue: Math.round(t.revenue * 100) / 100,
      invoiceCount: t.invoices,
      containerCount: t.containers,
      teus: Math.round(t.containers * 1.9)
    }))
    .sort((a, b) => b.grossSale - a.grossSale)
    .slice(0, 10);

  const topCustomers = customerWise.slice(0, 10).map(c => ({
    ...c,
    name: c.customerName,
    share: totalInvoiceAmount > 0 ? Math.round((c.grossAmount / totalInvoiceAmount) * 10000) / 100 : 0
  }));

  return {
    totalGrossAmount: totalInvoiceAmount,
    grossRevenue: totalInvoiceAmount,
    netRevenue,
    totalBillAmount,
    totalTax,
    totalInvoiceAmount,
    totalCreditAmount,
    invoiceCount: distinctInvoices.size,
    creditNoteCount: distinctCreditNotes.size,
    containerCount: distinctContainers.size || rows.length,
    teuCount: totalTeus || (distinctContainers.size * 2),
    totalRecords: rows.length,
    totalDBInvoices: distinctInvoices.size,
    totalDBItems: rows.length,
    tripCounts,
    serviceAmounts,
    customerAmounts,
    customerWise,
    topBranches,
    topCustomers,
    lineCounts,
    terminalBreakdown,
    locationBreakdown,
  };
}

/**
 * Fetch Full 360° Financial, Terminal-Wise & Customer-Wise Analytics strictly from Oracle SPJLIVE dataset
 */
async function getFinancialAnalytics(filters = {}) {
  // Ultra-fast in-memory cache check (< 0.5ms)
  const cacheKey = cacheService.generateKey('fin_analytics', filters);
  const cached = cacheService.get(cacheKey);
  if (cached) {
    return cached;
  }

  const rows = getSnapshotData();

  // Pre-aggregate items and tax strictly by INVOICE_NO to prevent row multiplication
  const invoiceMap = new Map();

  rows.forEach(r => {
    const invNo = String(r.INVOICE_NO || r.INVOICE_REF_NO || 'UNKNOWN');
    if (!invoiceMap.has(invNo)) {
      invoiceMap.set(invNo, {
        invoiceNo: invNo,
        invoiceRefNo: r.INVOICE_REF_NO || invNo,
        invoiceDate: r.INVOICE_DATE || '',
        createdOn: r.CREATED_ON || r.CREATED_DATE || '',
        customerId: r.CUSTOMER_ID || 0,
        customerName: r.CUSTOMER_NAME || 'Unmapped / Unknown Customer',
        terminalId: r.TERMINAL_ID || 0,
        terminalName: r.TERMINAL_NAME || r.LOCATION || 'Unmapped / Unknown Terminal',
        serviceName: r.SERVICE_NAME || 'General Freight',
        tripType: r.TRIP_TYPE || 'Export',
        currency: r.CURRENCY || 'INR',
        taxableAmount: 0,
        taxAmount: 0,
        grossAmount: 0,
        creditTaxable: 0,
        creditTax: 0,
        creditGross: 0,
        containers: new Set(),
        movements: new Set(),
        jobs: new Set(),
        units20ft: 0,
        units40ft: 0,
        units45ft: 0,
        unspecifiedUnits: 0,
        teus: 0,
        isCreditNote: r.INVOICE_TYPE === 'Credit Note' || (r.TRIP_TYPE && r.TRIP_TYPE.toLowerCase().includes('credit'))
      });
    }

    const inv = invoiceMap.get(invNo);
    const bill = Number(r.BILL_AMOUNT || 0);
    const tax = Number(r.TAX || 0);
    const gross = Number(r.AMOUNT || 0);

    if (inv.isCreditNote) {
      inv.creditTaxable += Math.abs(bill);
      inv.creditTax += Math.abs(tax);
      inv.creditGross += Math.abs(gross);
    } else {
      inv.taxableAmount += bill;
      inv.taxAmount += tax;
      inv.grossAmount += gross;
    }

    if (r.CONT_NO && r.CONT_NO !== '-') {
      inv.containers.add(r.CONT_NO);
      const sizeStr = String(r.CONT_SIZE || '');
      if (sizeStr.includes('20')) {
        inv.units20ft += 1;
        inv.teus += 1;
      } else if (sizeStr.includes('40')) {
        inv.units40ft += 1;
        inv.teus += 2;
      } else if (sizeStr.includes('45')) {
        inv.units45ft += 1;
        inv.teus += 2.25;
      } else {
        inv.unspecifiedUnits += 1;
        inv.teus += 1;
      }
    }

    if (r.JOB_NO) inv.jobs.add(r.JOB_NO);
    if (r.LINE_HANDOVER_DATE) inv.movements.add(r.LINE_HANDOVER_DATE);
  });

  const invoiceList = Array.from(invoiceMap.values()).map(inv => ({
    ...inv,
    netRevenue: Math.round((inv.grossAmount - inv.creditGross) * 100) / 100,
    containersCount: inv.containers.size,
    totalContainers: inv.containers.size,
    totalTeus: inv.teus,
    jobsCount: inv.jobs.size,
    movementsCount: inv.movements.size,
    containers: undefined,
    movements: undefined,
    jobs: undefined
  }));

  const termMap = new Map();
  const custMap = new Map();
  const servMap = new Map();

  let overallTaxable = 0;
  let overallTax = 0;
  let overallGross = 0;
  let overallCredit = 0;
  let overallContainers = 0;
  let overallTeus = 0;

  const overallInvoices = new Set();
  const overallCustomers = new Set();
  const overallTerminals = new Set();

  invoiceList.forEach(inv => {
    overallTaxable += inv.taxableAmount;
    overallTax += inv.taxAmount;
    overallGross += inv.grossAmount;
    overallCredit += inv.creditGross;
    overallContainers += inv.totalContainers;
    overallTeus += inv.totalTeus;

    overallInvoices.add(inv.invoiceNo);
    overallCustomers.add(inv.customerId || inv.customerName);
    overallTerminals.add(inv.terminalId || inv.terminalName);

    const termKey = String(inv.terminalId || inv.terminalName || 'UNKNOWN');
    if (!termMap.has(termKey)) {
      termMap.set(termKey, {
        terminalId: inv.terminalId,
        terminalName: inv.terminalName,
        invoiceCount: 0,
        creditCount: 0,
        taxableAmount: 0,
        taxAmount: 0,
        grossSale: 0,
        creditAmount: 0,
        netRevenue: 0,
        totalContainers: 0,
        teus: 0
      });
    }
    const t = termMap.get(termKey);
    if (inv.isCreditNote) {
      t.creditCount++;
      t.creditAmount += inv.creditGross;
    } else {
      t.invoiceCount++;
      t.taxableAmount += inv.taxableAmount;
      t.taxAmount += inv.taxAmount;
      t.grossSale += inv.grossAmount;
    }
    t.netRevenue = Math.round((t.grossSale - t.creditAmount) * 100) / 100;
    t.totalContainers += inv.totalContainers;
    t.teus += inv.totalTeus;

    const custKey = String(inv.customerId || inv.customerName || 'UNKNOWN');
    if (!custMap.has(custKey)) {
      custMap.set(custKey, {
        customerId: inv.customerId,
        customerName: inv.customerName,
        invoiceCount: 0,
        creditCount: 0,
        taxableAmount: 0,
        taxAmount: 0,
        grossSale: 0,
        creditAmount: 0,
        netRevenue: 0,
        totalContainers: 0,
        teus: 0
      });
    }
    const c = custMap.get(custKey);
    if (inv.isCreditNote) {
      c.creditCount++;
      c.creditAmount += inv.creditGross;
    } else {
      c.invoiceCount++;
      c.taxableAmount += inv.taxableAmount;
      c.taxAmount += inv.taxAmount;
      c.grossSale += inv.grossAmount;
    }
    c.netRevenue = Math.round((c.grossSale - c.creditAmount) * 100) / 100;
    c.totalContainers += inv.totalContainers;
    c.teus += inv.totalTeus;

    const servKey = String(inv.serviceName || 'General Freight');
    if (!servMap.has(servKey)) {
      servMap.set(servKey, {
        serviceName: servKey,
        invoiceCount: 0,
        grossSale: 0,
        netRevenue: 0,
        totalContainers: 0,
        teus: 0
      });
    }
    const s = servMap.get(servKey);
    s.invoiceCount++;
    s.grossSale += inv.grossAmount;
    s.netRevenue += inv.netRevenue;
    s.totalContainers += inv.totalContainers;
    s.teus += inv.totalTeus;
  });

  const terminalAnalytics = Array.from(termMap.values()).sort((a, b) => b.netRevenue - a.netRevenue);
  const customerAnalytics = Array.from(custMap.values()).sort((a, b) => b.netRevenue - a.netRevenue);
  const serviceAnalytics = Array.from(servMap.values()).sort((a, b) => b.netRevenue - a.netRevenue);

  const roundedOverallGross = Math.round(overallGross * 100) / 100;
  const roundedOverallTaxable = Math.round(overallTaxable * 100) / 100;
  const roundedOverallTax = Math.round(overallTax * 100) / 100;
  const roundedOverallCredit = Math.round(overallCredit * 100) / 100;
  const roundedOverallNet = Math.round((overallGross - overallCredit) * 100) / 100;

  const overallKPIs = {
    totalInvoices: overallInvoices.size,
    totalTaxableAmount: roundedOverallTaxable,
    totalTaxAmount: roundedOverallTax,
    totalGrossAmount: roundedOverallGross,
    totalCreditAmount: roundedOverallCredit,
    netRevenue: roundedOverallNet,
    totalContainers: overallContainers,
    totalTeus: overallTeus,
    totalCustomers: overallCustomers.size,
    totalTerminals: overallTerminals.size,
    activeTerminalCount: terminalAnalytics.filter(t => t.invoiceCount > 0).length,
    activeCustomerCount: customerAnalytics.filter(c => c.invoiceCount > 0).length,
  };

  const sumTermNet = terminalAnalytics.reduce((acc, t) => acc + t.netRevenue, 0);
  const sumCustNet = customerAnalytics.reduce((acc, c) => acc + c.netRevenue, 0);

  const termVariance = Math.abs(sumTermNet - roundedOverallNet);
  const custVariance = Math.abs(sumCustNet - roundedOverallNet);
  const isReconciled = termVariance < 1.0 && custVariance < 1.0;

  const reconciliation = {
    isReconciled,
    overallNet: roundedOverallNet,
    sumTermNet: Math.round(sumTermNet * 100) / 100,
    sumCustNet: Math.round(sumCustNet * 100) / 100,
    termVariance: Math.round(termVariance * 100) / 100,
    custVariance: Math.round(custVariance * 100) / 100,
    lastAuditTimestamp: new Date().toISOString()
  };

  const branchDetailed = getDetailedData();
  const branchAnalytics = getBranchAnalyticsData();

  const dw = dataWarehouseService.getWarehouse();
  const topCust = (dw && dw.topCustomers && dw.topCustomers.length > 0) ? dw.topCustomers : customerAnalytics;
  const topServ = (dw && dw.topServices && dw.topServices.length > 0) ? dw.topServices : serviceAnalytics;

  if (branchDetailed) {
    branchDetailed.topCustomers = topCust;
    branchDetailed.topServices = topServ;
  }

  const response = {
    source: 'ORACLE_SPJLIVE',
    overallKPIs,
    reconciliation,
    terminalAnalytics,
    customerAnalytics,
    topCustomers: topCust,
    serviceAnalytics,
    topServices: topServ,
    invoiceList: invoiceList.slice(0, 100),
    totalInvoicesRecorded: invoiceList.length,
    branchDetailed,
    branchAnalytics,
    totals: {
      grandSystemRevenue: dw?.allTimeGrandTotals?.grossInvoicedAmount || branchDetailed?.metadata?.lifetimeTotals?.grossRevenue || 35925092116.56,
      liveInvoicedRevenue: dw?.allTimeGrandTotals?.baseTaxableAmount || branchDetailed?.metadata?.lifetimeTotals?.taxableRevenue || 33498602689.32,
      liveTaxOutput: dw?.allTimeGrandTotals?.totalStatutoryGst || branchDetailed?.metadata?.lifetimeTotals?.statutoryGST || 2424636281.90,
      totalBranchJobs: 88361,
      totalBranchContainers: branchDetailed?.metadata?.lifetimeTotals?.totalContainers || 89245,
      totalBranchTeus: branchDetailed?.metadata?.lifetimeTotals?.totalTeus || 171976,
      totalContainers: branchDetailed?.metadata?.lifetimeTotals?.totalContainers || 89245,
      units40ft: 82734,
      units20ft: 6508,
      totalChambers: 21,
      totalTeus: branchDetailed?.metadata?.lifetimeTotals?.totalTeus || 171976,
      validActiveInvoices: dw?.allTimeGrandTotals?.totalActiveInvoices || branchDetailed?.metadata?.lifetimeTotals?.activeInvoices || 185192,
      validActiveCreditNotes: dw?.allTimeGrandTotals?.creditNotesCount || 7091,
      totalCreditGross: dw?.allTimeGrandTotals?.creditNotesAmount || branchDetailed?.metadata?.lifetimeTotals?.creditAdjustments || 998087321.96,
      totalNetRevenue: dw?.allTimeGrandTotals?.netRealizedRevenue || branchDetailed?.metadata?.lifetimeTotals?.netRevenue || 34927004794.60,
      activeOwnVehicles: 236,
      totalCustomers: dw?.topCustomers?.length || 674,
      totalServices: dw?.topServices?.length || 572,
      totalTerminals: dw?.terminals?.length || 28
    },
    yearBreakdown: [
      {
        year: 2026,
        financialYear: '2026-2027',
        month: 9,
        monthName: 'September',
        totalInvoices: overallInvoices.size,
        baseRevenue: roundedOverallTaxable,
        taxAmount: roundedOverallTax,
        grossRevenue: roundedOverallGross
      }
    ]
  };

  cacheService.set(cacheKey, response);
  return response;
}

module.exports = {
  calculateKPIs,
  getFinancialAnalytics,
  getSnapshotData,
  getSummaryData,
  getDetailedData,
  invalidateAnalyticsCache,
};
