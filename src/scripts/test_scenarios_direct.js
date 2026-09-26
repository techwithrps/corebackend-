const cirService = require('../services/cirService');
const { normalizeAnalyticsFilters } = require('../utils/dateUtils');

async function runDirectScenarios() {
  const testCases = [
    {
      name: 'CASE 1: FY 2025-26, Company=ALL, Customer=ALL, Terminal=ALL',
      query: { financialYear: 'FY 2025-26' }
    },
    {
      name: 'CASE 2: Custom 2-Day (2026-09-01 -> 2026-09-02)',
      query: { fromDate: '2026-09-01', toDate: '2026-09-02' }
    },
    {
      name: 'CASE 3: Custom 30-Day (2026-09-01 -> 2026-09-30)',
      query: { fromDate: '2026-09-01', toDate: '2026-09-30' }
    },
    {
      name: 'CASE 4: Company + Customer',
      query: { companyId: '2', customerId: 'COSTA CONTAINER LINES INDIA PVT LTD' }
    },
    {
      name: 'CASE 5: Company + Customer + Terminal',
      query: { companyId: '2', customerId: 'COSTA CONTAINER LINES INDIA PVT LTD', terminalId: '1' }
    },
    {
      name: 'CASE 6: Company + Customer + Terminal + Custom Date Range',
      query: { companyId: '2', customerId: 'COSTA CONTAINER LINES INDIA PVT LTD', terminalId: '1', fromDate: '2026-04-01', toDate: '2026-09-26' }
    }
  ];

  console.log('===========================================================');
  console.log('FRONTEND-BACKEND SINGLE SOURCE OF TRUTH VERIFICATION');
  console.log('===========================================================\n');

  for (const tc of testCases) {
    console.log(`--- ${tc.name} ---`);
    const filters = normalizeAnalyticsFilters(tc.query);

    const [finAnalytics, cirReport] = await Promise.all([
      cirService.getFinancialAnalytics(filters),
      cirService.getCIRReport({ ...filters, page: 1, limit: 50 })
    ]);

    const finKpis = finAnalytics.kpis;
    const cirKpis = cirReport.kpis;

    console.log('Filters normalized:', JSON.stringify({
      fromDateStr: filters.fromDateStr,
      toDateStr: filters.toDateStr,
      financialYear: filters.financialYear,
      companyId: filters.companyId,
      customerId: filters.customerId,
      terminalId: filters.terminalId
    }));

    console.log('Financial Analytics KPIs:', {
      grossRevenue: finKpis.totalGrossAmount,
      invoiceCount: finKpis.invoiceCount,
      containerCount: finKpis.containerCount,
      teuCount: finKpis.teuCount
    });

    console.log('CIR Report KPIs:', {
      grossRevenue: cirKpis.totalGrossAmount,
      invoiceCount: cirKpis.totalRecords,
      containerCount: cirKpis.containerCount,
      teuCount: cirKpis.teuCount
    });

    console.log('Breakdowns:', {
      topCustomers: finAnalytics.topCustomers.length,
      topServices: finAnalytics.topServices.length,
      terminalAnalytics: finAnalytics.terminalAnalytics.length
    });

    const matchGross = Math.abs(finKpis.totalGrossAmount - cirKpis.totalGrossAmount) < 0.01;
    const matchInvs = finKpis.invoiceCount === cirKpis.totalRecords;
    const matchConts = finKpis.containerCount === cirKpis.containerCount;

    if (matchGross && matchInvs && matchConts) {
      console.log('STATUS: ✅ PERFECT MATCH ACROSS CIR TABLE & FINANCIAL ANALYTICS\n');
    } else {
      console.log('STATUS: ❌ MISMATCH DETECTED\n');
    }
  }
}

runDirectScenarios();
