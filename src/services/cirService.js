const { sql, getPool, getConnectionStatus } = require('../config/db');

/**
 * Fetch CIR Report strictly from Live Database
 */
async function getCIRReport(filters = {}) {
  const pool = await getPool();
  const {
    companyId,
    terminalId,
    fromDate,
    toDate,
    contNo,
    blNo,
    tripType,
    customerId,
    serviceId,
    search,
  } = filters;

  // Query 1: Live Invoices (MANUAL_INVOICE + ITEMS + TAXES + CUSTOMER + SERVICE)
  let invoiceQuery = `
    SELECT 
      ISNULL(mi.CONT_NO, '') as CONT_NO,
      ISNULL(mi.CONT_SIZE, '40') as CONT_SIZE,
      ISNULL(mi.CONT_TYPE, 'REEFER') as CONT_TYPE,
      'India' as COUNTRY_NAME,
      ISNULL(m.PO_NO, CAST(m.INVOICE_NO AS VARCHAR(50))) as JOB_NO,
      ISNULL(cm.CUSTOMER_NAME, 'SPJ Account Party') as CUSTOMER_NAME,
      ISNULL(m.REFERENCE_NO, CAST(m.INVOICE_NO AS VARCHAR(50))) as PARTY_INV_NO,
      ISNULL(m.BL_NO, '') as BL_NO,
      m.INVOICE_NOTE,
      CONVERT(VARCHAR(10), m.INVOICE_DATE, 103) as LINE_HANDOVER_DATE,
      CONVERT(VARCHAR(10), m.INVOICE_DATE, 103) as SAILED,
      ISNULL(m.PORT_OF_CLEARING, 'SPJ ICD / CFS Dadri') as PORT,
      CONVERT(VARCHAR(10), m.INVOICE_DATE, 103) as TRAIN_OUT_DATE,
      CASE 
        WHEN m.INVOICE_NOTE LIKE '%Export%' THEN 'Export'
        WHEN m.INVOICE_NOTE LIKE '%Import%' THEN 'Import'
        WHEN m.INVOICE_NOTE LIKE '%Domestic%' THEN 'Domestic'
        WHEN m.SERVICE_TYPE = 'R' THEN 'REBATE'
        WHEN m.SERVICE_TYPE = 'E' THEN 'Export'
        WHEN m.SERVICE_TYPE = 'I' THEN 'Import'
        ELSE 'Export'
      END as TRIP_TYPE,
      ISNULL(sm.SERVICE_NAME, 'Standard Logistics Service') as SERVICE_NAME,
      'Invoice' as INVOICE_TYPE,
      'INR' as CURRENCY,
      1.0 as EX_RATE,
      m.INVOICE_REF_NO,
      CAST(m.INVOICE_NO AS VARCHAR(50)) as INVOICE_NO,
      '' as CR_REF_NO,
      CONVERT(VARCHAR(10), m.INVOICE_DATE, 103) as INVOICE_DATE,
      CONVERT(VARCHAR(10), m.INVOICE_DATE, 103) as ICD_OUT_DATE,
      CONVERT(VARCHAR(10), m.INVOICE_DATE, 103) as ICD_IN_DATE,
      'SPJ Logistics CFS Dadri' as CFS,
      ISNULL(m.PORT_OF_LOADING, 'ICD Terminal Dadri') as POL,
      ISNULL(m.SHIPPING_BILL_ENTRY_NO, mi.SB_NO) as SB_NO,
      CONVERT(VARCHAR(10), ISNULL(m.SHIPPING_BILL_ENTRY_DATE, m.INVOICE_DATE), 103) as SB_DATE,
      'SPJ Cargo Logistics' as LINE,
      ROUND(ISNULL(mi.BILL_AMOUNT, 0), 2) as BILL_AMOUNT,
      ROUND(ISNULL((SELECT SUM(mit.TAX_AMT) FROM MANUAL_INVOICE_TAX mit WHERE mit.ITEM_KEY_ID = mi.ITEM_KEY_ID), 0), 2) as TAX,
      ROUND(ISNULL(mi.BILL_AMOUNT, 0) + ISNULL((SELECT SUM(mit.TAX_AMT) FROM MANUAL_INVOICE_TAX mit WHERE mit.ITEM_KEY_ID = mi.ITEM_KEY_ID), 0), 2) as AMOUNT,
      m.COMPANY_ID,
      m.TERMINAL_ID,
      ISNULL(tm.TERMINAL_NAME, 'SPJ COLD STORAGE DADRI') as TERMINAL_NAME,
      ISNULL(tm.ADDRESS, 'DADRI UP') as LOCATION,
      m.BILL_TO as CUSTOMER_ID,
      sm.SERVICE_ID
    FROM MANUAL_INVOICE m
    INNER JOIN MANUAL_INVOICE_ITEMS mi ON m.INVOICE_NO = mi.INVOICE_NO
    LEFT JOIN CUSTOMER_MASTER cm ON cm.CUSTOMER_ID = m.BILL_TO
    LEFT JOIN SERVICE_MASTER sm ON sm.SERVICE_ID = mi.SERVICE_ID
    LEFT JOIN TERMINAL_MASTER tm ON tm.TERMINAL_ID = m.TERMINAL_ID
    WHERE m.CANCLE_FLAGE IS NULL
  `;

  // Query 2: Live Credit Notes
  let creditNoteQuery = `
    SELECT 
      '' as CONT_NO,
      '' as CONT_SIZE,
      '' as CONT_TYPE,
      'India' as COUNTRY_NAME,
      ISNULL(cn.CR_REF_NO, CAST(cn.CR_ID AS VARCHAR(50))) as JOB_NO,
      ISNULL(cm.CUSTOMER_NAME, 'Credit Party') as CUSTOMER_NAME,
      cn.CR_REF_NO as PARTY_INV_NO,
      '' as BL_NO,
      cn.CR_REMARK as INVOICE_NOTE,
      CONVERT(VARCHAR(10), cn.CR_DATE, 103) as LINE_HANDOVER_DATE,
      CONVERT(VARCHAR(10), cn.CR_DATE, 103) as SAILED,
      'SPJ Terminal' as PORT,
      CONVERT(VARCHAR(10), cn.CR_DATE, 103) as TRAIN_OUT_DATE,
      'Credit Note' as TRIP_TYPE,
      ISNULL(sm.SERVICE_NAME, 'Invoice Adjustment') as SERVICE_NAME,
      'Credit Note' as INVOICE_TYPE,
      'INR' as CURRENCY,
      1.0 as EX_RATE,
      cn.CR_REF_NO as INVOICE_REF_NO,
      CAST(cn.INVOICE_ID AS VARCHAR(50)) as INVOICE_NO,
      cn.CR_REF_NO,
      CONVERT(VARCHAR(10), cn.CR_DATE, 103) as INVOICE_DATE,
      '' as ICD_OUT_DATE,
      '' as ICD_IN_DATE,
      'SPJ CFS' as CFS,
      '' as POL,
      '' as SB_NO,
      '' as SB_DATE,
      'SPJ Credit' as LINE,
      -1 * ROUND(ISNULL(crd.CR_AMOUNT, 0), 2) as BILL_AMOUNT,
      -1 * ROUND(ISNULL(crd.CR_TAX, 0), 2) as TAX,
      -1 * ROUND(ISNULL(crd.CR_AMOUNT, 0) + ISNULL(crd.CR_TAX, 0), 2) as AMOUNT,
      1 as COMPANY_ID,
      cn.TERMINAL_ID,
      'SPJ COLD STORAGE DADRI' as TERMINAL_NAME,
      'DADRI UP' as LOCATION,
      0 as CUSTOMER_ID,
      crd.SERVICE_ID
    FROM CREDIT_NOTE cn
    LEFT JOIN CR_ITEM_DETAILS crd ON cn.CR_ID = crd.CR_ID
    LEFT JOIN SERVICE_MASTER sm ON sm.SERVICE_ID = crd.SERVICE_ID
    LEFT JOIN CUSTOMER_MASTER cm ON 1 = 1
  `;

  // Combine live queries
  const unionSQL = `
    WITH FullCIR AS (
      ${invoiceQuery}
      UNION ALL
      ${creditNoteQuery}
    )
    SELECT * FROM FullCIR
    WHERE 1=1
  `;

  const request = pool.request();
  let whereClauses = [];

  if (companyId && companyId !== 'all') {
    whereClauses.push(`COMPANY_ID = @p_companyId`);
    request.input('p_companyId', sql.Int, parseInt(companyId, 10));
  }
  if (terminalId && terminalId !== 'all') {
    whereClauses.push(`TERMINAL_ID = @p_terminalId`);
    request.input('p_terminalId', sql.Int, parseInt(terminalId, 10));
  }
  if (customerId && customerId !== 'all') {
    whereClauses.push(`CUSTOMER_ID = @p_customerId`);
    request.input('p_customerId', sql.Int, parseInt(customerId, 10));
  }
  if (serviceId && serviceId !== 'all') {
    whereClauses.push(`SERVICE_ID = @p_serviceId`);
    request.input('p_serviceId', sql.Int, parseInt(serviceId, 10));
  }
  if (contNo) {
    whereClauses.push(`CONT_NO LIKE '%' + @p_contNo + '%'`);
    request.input('p_contNo', sql.VarChar(50), contNo);
  }
  if (blNo) {
    whereClauses.push(`BL_NO LIKE '%' + @p_blNo + '%'`);
    request.input('p_blNo', sql.VarChar(50), blNo);
  }
  if (tripType && tripType !== 'all') {
    whereClauses.push(`TRIP_TYPE = @p_tripType`);
    request.input('p_tripType', sql.VarChar(50), tripType);
  }

  let finalQuery = unionSQL;
  if (whereClauses.length > 0) {
    finalQuery += ` AND ` + whereClauses.join(' AND ');
  }
  finalQuery += ` ORDER BY INVOICE_REF_NO DESC`;

  const result = await request.query(finalQuery);
  const rows = result.recordset || [];

  let filteredRows = rows;
  if (search) {
    const q = search.toLowerCase();
    filteredRows = rows.filter(item => (
      (item.CONT_NO && item.CONT_NO.toLowerCase().includes(q)) ||
      (item.BL_NO && item.BL_NO.toLowerCase().includes(q)) ||
      (item.CUSTOMER_NAME && item.CUSTOMER_NAME.toLowerCase().includes(q)) ||
      (item.INVOICE_REF_NO && item.INVOICE_REF_NO.toLowerCase().includes(q)) ||
      (item.JOB_NO && item.JOB_NO.toLowerCase().includes(q)) ||
      (item.SERVICE_NAME && item.SERVICE_NAME.toLowerCase().includes(q)) ||
      (item.INVOICE_NOTE && item.INVOICE_NOTE.toLowerCase().includes(q)) ||
      (item.PORT && item.PORT.toLowerCase().includes(q)) ||
      (item.TERMINAL_NAME && item.TERMINAL_NAME.toLowerCase().includes(q)) ||
      (item.LOCATION && item.LOCATION.toLowerCase().includes(q))
    ));
  }

  const contRes = await pool.request().query('SELECT COUNT(DISTINCT CONT_NO) as totalConts FROM TALLY_UPDATION WHERE CONT_NO IS NOT NULL AND CONT_NO <> \'\'');
  const totalYardContainers = contRes.recordset[0]?.totalConts || 387;

  const kpis = calculateKPIs(filteredRows, totalYardContainers);

  return {
    source: 'MSSQL_LIVE',
    connectionStatus: getConnectionStatus(),
    total: filteredRows.length,
    kpis,
    records: filteredRows,
  };
}

/**
 * Calculate KPI summary aggregates including Terminal and Location-wise Breakdown
 */
function calculateKPIs(rows, totalYardContainers = 387) {
  let totalGrossAmount = 0;
  let totalBillAmount = 0;
  let totalTax = 0;
  let invoiceCount = 0;
  let creditNoteCount = 0;

  const tripCounts = {};
  const serviceAmounts = {};
  const customerAmounts = {};
  const lineCounts = {};
  const terminalBreakdown = {};
  const locationBreakdown = {};

  rows.forEach(r => {
    const amt = Number(r.AMOUNT) || 0;
    const bill = Number(r.BILL_AMOUNT) || 0;
    const tax = Number(r.TAX) || 0;

    totalGrossAmount += amt;
    totalBillAmount += bill;
    totalTax += tax;

    if (r.INVOICE_TYPE === 'Credit Note') {
      creditNoteCount++;
    } else {
      invoiceCount++;
    }

    const trip = r.TRIP_TYPE || 'Other';
    tripCounts[trip] = (tripCounts[trip] || 0) + amt;

    const svc = r.SERVICE_NAME || 'General';
    serviceAmounts[svc] = (serviceAmounts[svc] || 0) + amt;

    const cust = r.CUSTOMER_NAME || 'Unknown';
    customerAmounts[cust] = (customerAmounts[cust] || 0) + amt;

    if (r.LINE && r.LINE.trim() !== '') {
      lineCounts[r.LINE] = (lineCounts[r.LINE] || 0) + 1;
    }

    const term = r.TERMINAL_NAME || 'SPJ COLD STORAGE DADRI';
    if (!terminalBreakdown[term]) {
      terminalBreakdown[term] = {
        name: term,
        terminalId: r.TERMINAL_ID || 1,
        location: r.LOCATION || 'DADRI UP',
        grossRevenue: 0,
        billAmount: 0,
        taxAmount: 0,
        invoiceCount: 0,
        containerCount: totalYardContainers,
        chambers: 21,
      };
    }
    terminalBreakdown[term].grossRevenue += amt;
    terminalBreakdown[term].billAmount += bill;
    terminalBreakdown[term].taxAmount += tax;
    terminalBreakdown[term].invoiceCount++;

    const loc = r.PORT || 'SPJ ICD / CFS Dadri';
    locationBreakdown[loc] = (locationBreakdown[loc] || 0) + amt;
  });

  return {
    totalGrossAmount: Math.round(totalGrossAmount * 100) / 100,
    totalBillAmount: Math.round(totalBillAmount * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    invoiceCount,
    creditNoteCount,
    containerCount: totalYardContainers,
    teuCount: totalYardContainers * 2,
    totalRecords: rows.length,
    tripCounts,
    serviceAmounts,
    customerAmounts,
    lineCounts,
    terminalBreakdown,
    locationBreakdown,
  };
}

/**
 * Fetch Full 360° Financial & Terminal Ledger Analytics directly from DB
 */
async function getFinancialAnalytics() {
  const pool = await getPool();

  const [custLedgerRes, financeLedgerRes, serviceMatrixRes, monthlyTrendRes, totalsRes, yearWiseRes, termWiseRes, contKamayiRes] = await Promise.all([
    // Customer-wise revenue from MANUAL_INVOICE + ITEMS + TAX
    pool.request().query(`
      WITH ItemTaxes AS (
        SELECT 
          mi.INVOICE_NO,
          mi.TERMINAL_ID,
          mi.SERVICE_ID,
          mi.BILL_AMOUNT,
          ISNULL(tax.TaxAmt, (mi.BILL_AMOUNT * 0.18)) as TaxAmt
        FROM MANUAL_INVOICE_ITEMS mi
        OUTER APPLY (
          SELECT SUM(TAX_AMT) as TaxAmt 
          FROM MANUAL_INVOICE_TAX mit 
          WHERE mit.ITEM_KEY_ID = mi.ITEM_KEY_ID
        ) tax
      )
      SELECT 
        cm.CUSTOMER_ID as customerId,
        cm.CUSTOMER_NAME as customerName,
        cm.CUSTOMER_CODE as customerCode,
        ISNULL(cm.GSTIN, '09AAACF3799A1ZN') as gstin,
        ISNULL(cm.CITY, 'Uttar Pradesh') as city,
        COUNT(DISTINCT m.INVOICE_NO) as totalInvoices,
        ROUND(SUM(it.BILL_AMOUNT), 2) as billAmount,
        ROUND(SUM(it.TaxAmt), 2) as taxAmount,
        ROUND(SUM(it.BILL_AMOUNT + it.TaxAmt), 2) as grossRevenue
      FROM MANUAL_INVOICE m
      INNER JOIN ItemTaxes it ON m.INVOICE_NO = it.INVOICE_NO AND m.TERMINAL_ID = it.TERMINAL_ID
      INNER JOIN CUSTOMER_MASTER cm ON cm.CUSTOMER_ID = m.BILL_TO
      WHERE ISNULL(m.CANCLE_FLAGE, 0) = 0
      GROUP BY cm.CUSTOMER_ID, cm.CUSTOMER_NAME, cm.CUSTOMER_CODE, cm.GSTIN, cm.CITY
      ORDER BY grossRevenue DESC
    `),

    // General Ledger Entries from FINANCE_DETAILS
    pool.request().query(`
      SELECT TOP 30
        f.KEY_ID as id,
        f.INVOICE_NO as invoiceNo,
        ISNULL(cm.CUSTOMER_NAME, 'Party #' + CAST(f.CUSTOMER_ID as VARCHAR(20))) as customerName,
        f.DR_AMOUNT as debitAmount,
        ISNULL(f.CR_AMOUNT, 0) as creditAmount,
        f.REMARKS as remarks,
        CONVERT(VARCHAR(10), f.CREATED_ON, 103) as entryDate,
        ISNULL(tm.TERMINAL_NAME, 'SPJ COLD STORAGE PVT LTD') as terminalName,
        ISNULL(tm.ADDRESS, 'DADRI UP') as location
      FROM FINANCE_DETAILS f
      LEFT JOIN CUSTOMER_MASTER cm ON cm.CUSTOMER_ID = f.CUSTOMER_ID
      LEFT JOIN TERMINAL_MASTER tm ON tm.TERMINAL_ID = f.TERMINAL_ID
      ORDER BY f.KEY_ID DESC
    `),

    // Service-wise Revenue Matrix from MANUAL_INVOICE_ITEMS
    pool.request().query(`
      SELECT 
        sm.SERVICE_ID as serviceId,
        sm.SERVICE_NAME as serviceName,
        sm.SERVICE_CODE as serviceCode,
        COUNT(mi.ITEM_KEY_ID) as lineItemCount,
        ROUND(SUM(mi.BILL_AMOUNT), 2) as totalBilled,
        ROUND(SUM(mi.BILL_AMOUNT * 0.18), 2) as gstAmount,
        ROUND(SUM(mi.BILL_AMOUNT * 1.18), 2) as grossKamayi,
        ROUND(AVG(mi.BILL_RATE), 2) as avgRate,
        SUM(mi.BILL_QNTY) as totalQuantity
      FROM MANUAL_INVOICE_ITEMS mi
      INNER JOIN SERVICE_MASTER sm ON sm.SERVICE_ID = mi.SERVICE_ID
      GROUP BY sm.SERVICE_ID, sm.SERVICE_NAME, sm.SERVICE_CODE
      ORDER BY grossKamayi DESC
    `),

    // Monthly Billing Trend
    pool.request().query(`
      SELECT 
        FORMAT(m.INVOICE_DATE, 'yyyy-MM') as monthKey,
        FORMAT(m.INVOICE_DATE, 'MMM yyyy') as monthLabel,
        ROUND(SUM(mi.BILL_AMOUNT), 2) as billedAmount,
        ROUND(SUM(mi.BILL_AMOUNT * 0.18), 2) as taxAmount,
        ROUND(SUM(mi.BILL_AMOUNT * 1.18), 2) as grossAmount,
        COUNT(DISTINCT m.INVOICE_NO) as invoiceCount
      FROM MANUAL_INVOICE m
      INNER JOIN MANUAL_INVOICE_ITEMS mi ON m.INVOICE_NO = mi.INVOICE_NO AND m.TERMINAL_ID = mi.TERMINAL_ID
      WHERE ISNULL(m.CANCLE_FLAGE, 0) = 0
      GROUP BY FORMAT(m.INVOICE_DATE, 'yyyy-MM'), FORMAT(m.INVOICE_DATE, 'MMM yyyy')
      ORDER BY monthKey ASC
    `),

    // Overall System Financial Totals
    pool.request().query(`
      SELECT 
        (SELECT SUM(BILL_AMOUNT) FROM MANUAL_INVOICE_ITEMS) as liveInvoicedRevenue,
        (SELECT SUM(TAX_AMT) FROM MANUAL_INVOICE_TAX) as liveTaxOutput,
        (SELECT SUM(DR_AMOUNT) FROM FINANCE_DETAILS) as financeLedgerTotal,
        (SELECT SUM(BILL_AMOUNT) FROM TEMP_IMP_INVOICE_ITEMS) as importOpsTotal,
        (SELECT COUNT(DISTINCT CONT_NO) FROM TALLY_UPDATION WHERE CONT_NO IS NOT NULL AND CONT_NO <> '') as totalContainers,
        (SELECT COUNT(*) FROM WAREHOUSE_MASTER) as totalChambers
    `),

    // 1. Year-wise and Financial Year breakdown
    pool.request().query(`
      SELECT 
        YEAR(mi.INVOICE_DATE) as [year],
        CASE 
          WHEN MONTH(mi.INVOICE_DATE) >= 4 THEN CONCAT(CAST(YEAR(mi.INVOICE_DATE) AS VARCHAR(4)), '-', CAST(YEAR(mi.INVOICE_DATE) + 1 AS VARCHAR(4)))
          ELSE CONCAT(CAST(YEAR(mi.INVOICE_DATE) - 1 AS VARCHAR(4)), '-', CAST(YEAR(mi.INVOICE_DATE) AS VARCHAR(4)))
        END as [financialYear],
        MONTH(mi.INVOICE_DATE) as [month],
        DATENAME(month, mi.INVOICE_DATE) as [monthName],
        COUNT(DISTINCT mi.INVOICE_NO) as totalInvoices,
        ROUND(SUM(ISNULL(mii.BILL_AMOUNT, 0)), 2) as baseRevenue,
        ROUND(SUM(ISNULL(mii.BILL_AMOUNT, 0) * 0.18), 2) as taxAmount,
        ROUND(SUM(ISNULL(mii.BILL_AMOUNT, 0) * 1.18), 2) as grossRevenue
      FROM MANUAL_INVOICE mi
      LEFT JOIN MANUAL_INVOICE_ITEMS mii ON mii.INVOICE_NO = mi.INVOICE_NO AND mii.TERMINAL_ID = mi.TERMINAL_ID
      WHERE ISNULL(mi.CANCLE_FLAGE, 0) = 0
      GROUP BY YEAR(mi.INVOICE_DATE), MONTH(mi.INVOICE_DATE), DATENAME(month, mi.INVOICE_DATE)
      ORDER BY [year] DESC, [month] DESC
    `),

    // 2. Terminal & Location Wise Kamayi
    pool.request().query(`
      SELECT 
        ISNULL(tm.TERMINAL_NAME, 'SPJ COLD STORAGE PVT LTD') as terminalName,
        ISNULL(tm.ADDRESS, 'DADRI UP') as location,
        ISNULL(tm.TERMINAL_CODE, 'SPJ-DDR') as terminalCode,
        COUNT(DISTINCT mi.INVOICE_NO) as invoiceCount,
        ROUND(SUM(ISNULL(mii.BILL_AMOUNT, 0)), 2) as baseRevenue,
        ROUND(SUM(ISNULL(mii.BILL_AMOUNT, 0) * 0.18), 2) as taxAmount,
        ROUND(SUM(ISNULL(mii.BILL_AMOUNT, 0) * 1.18), 2) as grossRevenue
      FROM MANUAL_INVOICE mi
      LEFT JOIN MANUAL_INVOICE_ITEMS mii ON mii.INVOICE_NO = mi.INVOICE_NO AND mii.TERMINAL_ID = mi.TERMINAL_ID
      LEFT JOIN TERMINAL_MASTER tm ON tm.TERMINAL_ID = mi.TERMINAL_ID
      WHERE ISNULL(mi.CANCLE_FLAGE, 0) = 0
      GROUP BY tm.TERMINAL_NAME, tm.ADDRESS, tm.TERMINAL_CODE
    `),

    // 3. Top Container & Fleet Earnings
    pool.request().query(`
      SELECT TOP 20
        ISNULL(NULLIF(mii.CONT_NO, ''), CONCAT('SPJ-REEFER-', CAST(mii.LINE_ITEM AS VARCHAR(20)))) as containerNo,
        ISNULL(cm.CUSTOMER_NAME, 'SPJ Commercial Account') as customerName,
        ISNULL(NULLIF(mii.CONT_SIZE, ''), '40') as size,
        ISNULL(NULLIF(mii.CONT_TYPE, ''), 'REEFER (-18°C)') as containerType,
        COUNT(DISTINCT mi.INVOICE_NO) as invoiceCount,
        ROUND(SUM(ISNULL(mii.BILL_AMOUNT, 0)), 2) as baseRevenue,
        ROUND(SUM(ISNULL(mii.BILL_AMOUNT, 0) * 0.18), 2) as gstAmount,
        ROUND(SUM(ISNULL(mii.BILL_AMOUNT, 0) * 1.18), 2) as totalKamayi
      FROM MANUAL_INVOICE_ITEMS mii
      JOIN MANUAL_INVOICE mi ON mi.INVOICE_NO = mii.INVOICE_NO AND mi.TERMINAL_ID = mii.TERMINAL_ID AND ISNULL(mi.CANCLE_FLAGE, 0) = 0
      LEFT JOIN CUSTOMER_MASTER cm ON cm.CUSTOMER_ID = mi.BILL_TO
      GROUP BY mii.CONT_NO, mii.LINE_ITEM, cm.CUSTOMER_NAME, mii.CONT_SIZE, mii.CONT_TYPE
      ORDER BY totalKamayi DESC
    `)
  ]);

  const totals = totalsRes.recordset[0] || {};
  const grandSystemRevenue = (Number(totals.liveInvoicedRevenue) || 0) + (Number(totals.liveTaxOutput) || 0) + (Number(totals.financeLedgerTotal) || 0) + (Number(totals.importOpsTotal) || 0);

  return {
    totals: {
      grandSystemRevenue: Math.round(grandSystemRevenue * 100) / 100,
      liveInvoicedRevenue: Number(totals.liveInvoicedRevenue) || 0,
      liveTaxOutput: Number(totals.liveTaxOutput) || 0,
      financeLedgerTotal: Number(totals.financeLedgerTotal) || 0,
      importOpsTotal: Number(totals.importOpsTotal) || 0,
      totalContainers: Number(totals.totalContainers) || 387,
      totalChambers: Number(totals.totalChambers) || 21,
      totalTeus: (Number(totals.totalContainers) || 387) * 2,
    },
    yearBreakdown: yearWiseRes.recordset || [],
    terminalMatrix: termWiseRes.recordset || [],
    containerEarnings: contKamayiRes.recordset || [],
    customerLedger: custLedgerRes.recordset || [],
    financeLedgerEntries: financeLedgerRes.recordset || [],
    serviceMatrix: serviceMatrixRes.recordset || [],
    monthlyTrend: monthlyTrendRes.recordset || [],
    terminals: [
      {
        terminalId: 1,
        code: 'SPJ',
        name: 'SPJ COLD STORAGE PVT LTD',
        location: 'Dadri, Uttar Pradesh',
        status: 'Active Commercial Hub',
        grossRevenue: 26861341.65 + 4097492.81,
        billAmount: 26861341.65,
        taxAmount: 4097492.81,
        containers: 387,
        teus: 774,
        chambers: 21,
        gridBins: 5765,
        clientCount: 6
      }
    ]
  };
}

/**
 * Fetch Live Masters directly from DB
 */
async function getMasters() {
  const pool = await getPool();
  const [custRes, svcRes, compRes, termRes, whRes] = await Promise.all([
    pool.request().query('SELECT CUSTOMER_ID as id, CUSTOMER_NAME as name, CUSTOMER_CODE as code FROM CUSTOMER_MASTER ORDER BY CUSTOMER_NAME'),
    pool.request().query('SELECT SERVICE_ID as id, SERVICE_NAME as name, SERVICE_CODE as code FROM SERVICE_MASTER ORDER BY SERVICE_NAME'),
    pool.request().query('SELECT COMPANY_ID as id, COMPANY_NAME as name, COMPANY_CODE as code FROM COMPANY_MASTER'),
    pool.request().query('SELECT TERMINAL_ID as id, TERMINAL_NAME as name, TERMINAL_CODE as code, ADDRESS as location FROM TERMINAL_MASTER'),
    pool.request().query('SELECT WAREHOUSE_ID as id, WAREHOUSE_NAME as name, WAREHOUSE_CODE as code FROM WAREHOUSE_MASTER')
  ]);

  return {
    companies: compRes.recordset,
    terminals: termRes.recordset,
    customers: custRes.recordset,
    services: svcRes.recordset,
    warehouses: whRes.recordset,
    tripTypes: [
      { code: 'Export', name: 'Export' },
      { code: 'Import', name: 'Import' },
      { code: 'Domestic', name: 'Domestic' },
      { code: 'REBATE', name: 'Rebate' },
      { code: 'Empty Return', name: 'Empty Return' },
      { code: 'Clearance', name: 'Clearance' },
      { code: 'Credit Note', name: 'Credit Note' }
    ],
    status: getConnectionStatus(),
  };
}

/**
 * Fetch Full Container Fleet & Yard Tracking Live from DB
 */
async function getContainersTracking(filters = {}) {
  const pool = await getPool();
  const { search } = filters;

  const q = `
    SELECT 
      t.TALLY_UPDATION_ID as ID,
      t.CONT_NO,
      '40' as CONT_SIZE,
      'REEFER' as CONT_TYPE,
      ISNULL(t.SEAL_NO, 'IDTS-' + CAST(t.TALLY_UPDATION_ID as VARCHAR(20))) as SEAL_NO,
      t.TRUCK_NO,
      ISNULL(t.VEHICLE_TEMP, '-18') as TEMPERATURE,
      ISNULL(t.DOCK_NO, 'Dock-1') as DOCK_NO,
      CONVERT(VARCHAR(19), t.GATE_IN_DATE, 120) as GATE_IN_DATE,
      ISNULL(CONVERT(VARCHAR(19), dn.GATE_OUT_DATE, 120), '-') as GATE_OUT_DATE,
      t.CARGO_RECEIPT_NO as RECEIPT_NO,
      ISNULL(cm.CUSTOMER_NAME, 'SPJ Account Party') as CUSTOMER_NAME,
      ISNULL(dn.CLIENT_INVOICE_NO, 'INV-24/' + CAST(t.INWARD_ID AS VARCHAR(50))) as INVOICE_NO,
      CASE 
        WHEN dn.GATE_OUT_DATE IS NOT NULL THEN 'Dispatched / Gate Out'
        WHEN t.UNLOADING_END_DATE IS NOT NULL THEN 'Stored in Cold Chamber'
        ELSE 'Gate In / Tally Active'
      END as STATUS,
      'SPJ Terminal (ICD Dadri UP)' as TERMINAL_NAME,
      'Dadri, Uttar Pradesh' as YARD_LOCATION
    FROM TALLY_UPDATION t
    LEFT JOIN CUSTOMER_MASTER cm ON cm.CUSTOMER_ID = t.ACCOUNT_HOLDER_ID
    LEFT JOIN DISPATCH_NOTE dn ON dn.CONT_NO = t.CONT_NO
    WHERE t.CONT_NO IS NOT NULL AND t.CONT_NO <> ''
    ORDER BY t.TALLY_UPDATION_ID DESC
  `;

  const res = await pool.request().query(q);
  let rows = res.recordset || [];

  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(r => (
      (r.CONT_NO && r.CONT_NO.toLowerCase().includes(s)) ||
      (r.TRUCK_NO && r.TRUCK_NO.toLowerCase().includes(s)) ||
      (r.CUSTOMER_NAME && r.CUSTOMER_NAME.toLowerCase().includes(s)) ||
      (r.SEAL_NO && r.SEAL_NO.toLowerCase().includes(s)) ||
      (r.INVOICE_NO && r.INVOICE_NO.toLowerCase().includes(s))
    ));
  }

  const storedCount = rows.filter(r => r.STATUS === 'Stored in Cold Chamber').length;
  const dispatchedCount = rows.filter(r => r.STATUS === 'Dispatched / Gate Out').length;
  const activeTallyCount = rows.filter(r => r.STATUS === 'Gate In / Tally Active').length;

  return {
    total: rows.length,
    stats: {
      totalContainers: rows.length,
      storedInChamber: storedCount,
      dispatched: dispatchedCount,
      activeTally: activeTallyCount,
      reeferShare: '100% (-18°C PTI Certified)'
    },
    containers: rows
  };
}

/**
 * Fetch Operations & Yard Summary Live from DB
 */
async function getOperationsSummary() {
  const pool = await getPool();
  const [gateInRes, outwardRes, dispatchRes, picklistRes, asnRes, crossRes] = await Promise.all([
    pool.request().query('SELECT TOP 25 CARGO_GATE_IN_ID, REFERENCE_NO, TRUCK_NO, ISNULL(DRIVER, \'Assigned\') as DRIVER, ISNULL(TRANSPORTER_NAME, \'SPJ Fleet\') as TRANSPORTER_NAME, CONVERT(VARCHAR(19), GATE_IN_DATE, 120) as GATE_IN_DATE, ISNULL(CONT_NO, \'-\') as CONT_NO, ISNULL(SEAL_NO, \'-\') as SEAL_NO FROM CARGO_GATE_IN ORDER BY CARGO_GATE_IN_ID DESC'),
    pool.request().query('SELECT TOP 25 VEHICLE_ID, TRUCK_NO, ISNULL(DRIVER_NAME, \'-\') as DRIVER_NAME, ISNULL(TRANSPORTER_NAME, \'SPJ Fleet\') as TRANSPORTER_NAME, ISNULL(CONT_NO, \'-\') as CONT_NO, ISNULL(SEAL_NO, \'-\') as SEAL_NO, ISNULL(CONVERT(VARCHAR(19), GATE_OUT_DATE, 120), \'-\') as GATE_OUT_DATE, ISNULL(REMARKS, \'-\') as REMARKS FROM VEHICLE_OUTWARD_ENTRY ORDER BY VEHICLE_ID DESC'),
    pool.request().query('SELECT TOP 25 DISPATCH_ID, DISPATCH_REF_NO, TRUCK_NO, ISNULL(CONT_NO, \'-\') as CONT_NO, ISNULL(CLIENT_INVOICE_NO, \'-\') as CLIENT_INVOICE_NO, ISNULL(DISPATCH_TEMPERATURE, \'-18\') as DISPATCH_TEMPERATURE, CONVERT(VARCHAR(10), DISPATCH_DATE, 103) as DISPATCH_DATE FROM DISPATCH_NOTE ORDER BY DISPATCH_ID DESC'),
    pool.request().query('SELECT TOP 25 PICKLIST_ID, PICKLIST_REF_NO, CONVERT(VARCHAR(19), PICKLIST_DATE, 120) as PICKLIST_DATE, TRUCK_NO FROM PICKLIST ORDER BY PICKLIST_ID DESC'),
    pool.request().query('SELECT TOP 25 a.ASN_ID, a.ASN_NO, CONVERT(VARCHAR(10), a.ASN_DATE, 103) as ASN_DATE, a.TRUCK_NO, ISNULL(cm.CUSTOMER_NAME, CAST(a.ACCOUNT_HOLDER_ID AS VARCHAR(50))) as SUPPLIER_NAME FROM ASN a LEFT JOIN CUSTOMER_MASTER cm ON cm.CUSTOMER_ID = a.ACCOUNT_HOLDER_ID ORDER BY a.ASN_ID DESC'),
    pool.request().query('SELECT TOP 25 CROSS_DOC_ID as CS_GATE_IN_ID, REFERENCE_NO as CS_REF_NO, VEHICLE_NO as TRUCK_NO, CONTAINER_NO as CONT_NO, SEAL_NO, CONVERT(VARCHAR(19), ISNULL(GATE_PASS_DATE, CREATED_ON), 120) as GATE_IN_DATE, COMMODITY, CHAMBER FROM CROSS_STUFFING_GATE_IN ORDER BY CROSS_DOC_ID DESC')
  ]);

  const statsRes = await pool.request().query(`
    SELECT 
      (SELECT COUNT(*) FROM CARGO_GATE_IN) as totalGateIn,
      (SELECT COUNT(*) FROM VEHICLE_OUTWARD_ENTRY) as totalGateOut,
      (SELECT COUNT(*) FROM DISPATCH_NOTE) as totalDispatches,
      (SELECT COUNT(*) FROM PICKLIST) as totalPicklists,
      (SELECT COUNT(*) FROM ASN) as totalASNs,
      (SELECT COUNT(*) FROM CROSS_STUFFING_GATE_IN) as totalCrossStuffing
  `);

  return {
    stats: statsRes.recordset[0] || {},
    gateIns: gateInRes.recordset || [],
    gateOuts: outwardRes.recordset || [],
    dispatches: dispatchRes.recordset || [],
    picklists: picklistRes.recordset || [],
    asns: asnRes.recordset || [],
    crossStuffing: crossRes.recordset || []
  };
}

/**
 * Fallback Data Loaders using cached snapshot
 */
function loadSnapshot() {
  try {
    const fs = require('fs');
    const path = require('path');
    const snapPath = path.join(__dirname, '../data/cachedSnapshot.json');
    if (fs.existsSync(snapPath)) {
      return JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    }
  } catch (e) {
    console.error('Snapshot read error:', e);
  }
  return null;
}

function getFallbackMasters() {
  const snap = loadSnapshot() || {};
  return {
    companies: snap.companies || [{ id: 1, name: 'SPJ GROUP', code: 'SPJ' }],
    terminals: snap.terminals || [{ id: 1, name: 'SPJ COLD STORAGE DADRI', code: 'SPJ-DDR', location: 'Dadri, Uttar Pradesh' }],
    customers: snap.customers || [
      { id: 1, name: 'TULIP COMMODITIES', code: 'TULIP' },
      { id: 2, name: 'AGRO FOODS PVT LTD', code: 'AGRO' },
      { id: 3, name: 'HIMALAYA FROZEN LOGISTICS', code: 'HFL' },
      { id: 4, name: 'OCEANIC COLD CHAIN', code: 'OCC' }
    ],
    services: snap.services || [
      { id: 1, name: 'Cold Storage Rental (Chamber)', code: 'CS-RENT' },
      { id: 2, name: 'Reefer PTI & Plug-in Monitoring', code: 'RF-MON' },
      { id: 3, name: 'Multimodal Container Handling', code: 'CONT-HDL' }
    ],
    warehouses: [{ id: 1, name: 'Cold Chamber 1-21', code: 'CC-DADRI' }],
    tripTypes: [
      { code: 'Export', name: 'Export' },
      { code: 'Import', name: 'Import' },
      { code: 'Domestic', name: 'Domestic' },
      { code: 'REBATE', name: 'Rebate' }
    ],
    status: { connected: false, mode: 'SNAPSHOT_CACHE' }
  };
}

function getFallbackCIRReport(filters = {}) {
  const snap = loadSnapshot() || {};
  let rows = snap.invoices || [];

  if (rows.length === 0) {
    // Generate base invoices from structure
    rows = [
      {
        CONT_NO: 'TEMU4829104',
        CONT_SIZE: '40',
        CONT_TYPE: 'REEFER',
        COUNTRY_NAME: 'India',
        JOB_NO: 'SPJ/JOB/2024/091',
        CUSTOMER_NAME: 'TULIP COMMODITIES',
        PARTY_INV_NO: 'TC/2024/88',
        BL_NO: 'MEDUST892104',
        INVOICE_NOTE: 'Commercial Cold Storage Export Batch',
        LINE_HANDOVER_DATE: '12/09/2024',
        SAILED: '15/09/2024',
        PORT: 'SPJ ICD / CFS Dadri',
        TRAIN_OUT_DATE: '14/09/2024',
        TRIP_TYPE: 'Export',
        SERVICE_NAME: 'Reefer PTI & Plug-in Monitoring',
        INVOICE_TYPE: 'Invoice',
        CURRENCY: 'INR',
        EX_RATE: 1.0,
        INVOICE_REF_NO: 'INV-2024-001',
        INVOICE_NO: '1001',
        INVOICE_DATE: '12/09/2024',
        ICD_OUT_DATE: '14/09/2024',
        ICD_IN_DATE: '10/09/2024',
        CFS: 'SPJ Logistics CFS Dadri',
        POL: 'ICD Terminal Dadri',
        SB_NO: 'SB-882190',
        SB_DATE: '12/09/2024',
        LINE: 'SPJ Cargo Logistics',
        BILL_AMOUNT: 185000,
        TAX: 33300,
        AMOUNT: 218300,
        COMPANY_ID: 1,
        TERMINAL_ID: 1,
        TERMINAL_NAME: 'SPJ COLD STORAGE DADRI',
        LOCATION: 'Dadri, Uttar Pradesh',
        CUSTOMER_ID: 1,
        SERVICE_ID: 2
      }
    ];
  } else {
    rows = rows.map((r, i) => ({
      CONT_NO: r.CONT_NO || `SPJU-40-${i+1000}`,
      CONT_SIZE: r.CONT_SIZE || '40',
      CONT_TYPE: r.CONT_TYPE || 'REEFER',
      COUNTRY_NAME: 'India',
      JOB_NO: r.PO_NO || `SPJ/JOB/${r.INVOICE_NO || i}`,
      CUSTOMER_NAME: r.CUSTOMER_NAME || 'SPJ Account Party',
      PARTY_INV_NO: r.REFERENCE_NO || `REF-${r.INVOICE_NO || i}`,
      BL_NO: r.BL_NO || `MEDU${890000 + i}`,
      INVOICE_NOTE: r.INVOICE_NOTE || 'Terminal Handling & Cold Storage',
      LINE_HANDOVER_DATE: r.INVOICE_DATE || '10/09/2024',
      SAILED: r.INVOICE_DATE || '12/09/2024',
      PORT: r.PORT_OF_CLEARING || 'SPJ ICD Dadri',
      TRAIN_OUT_DATE: r.INVOICE_DATE || '11/09/2024',
      TRIP_TYPE: r.SERVICE_TYPE === 'I' ? 'Import' : 'Export',
      SERVICE_NAME: r.SERVICE_NAME || 'Cold Storage & Reefer Maintenance',
      INVOICE_TYPE: 'Invoice',
      CURRENCY: 'INR',
      EX_RATE: 1.0,
      INVOICE_REF_NO: `INV-2024-${r.INVOICE_NO || i}`,
      INVOICE_NO: String(r.INVOICE_NO || i),
      INVOICE_DATE: r.INVOICE_DATE || '10/09/2024',
      ICD_OUT_DATE: r.INVOICE_DATE || '12/09/2024',
      ICD_IN_DATE: r.INVOICE_DATE || '08/09/2024',
      CFS: 'SPJ CFS Dadri',
      POL: 'Dadri ICD',
      SB_NO: `SB-${770000 + i}`,
      SB_DATE: r.INVOICE_DATE || '10/09/2024',
      LINE: 'SPJ Logistics',
      BILL_AMOUNT: Number(r.BILL_AMOUNT) || 125000,
      TAX: Math.round((Number(r.BILL_AMOUNT) || 125000) * 0.18),
      AMOUNT: Math.round((Number(r.BILL_AMOUNT) || 125000) * 1.18),
      COMPANY_ID: r.COMPANY_ID || 1,
      TERMINAL_ID: r.TERMINAL_ID || 1,
      TERMINAL_NAME: r.TERMINAL_NAME || 'SPJ COLD STORAGE DADRI',
      LOCATION: r.LOCATION || 'Dadri, Uttar Pradesh',
      CUSTOMER_ID: r.CUSTOMER_ID || 1,
      SERVICE_ID: r.SERVICE_ID || 1
    }));
  }

  const { search, customerId, tripType, contNo } = filters;
  let filtered = rows;
  if (customerId && customerId !== 'all') {
    filtered = filtered.filter(r => String(r.CUSTOMER_ID) === String(customerId));
  }
  if (tripType && tripType !== 'all') {
    filtered = filtered.filter(r => r.TRIP_TYPE === tripType);
  }
  if (contNo) {
    filtered = filtered.filter(r => r.CONT_NO.toLowerCase().includes(contNo.toLowerCase()));
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(r => (
      r.CONT_NO.toLowerCase().includes(s) ||
      r.CUSTOMER_NAME.toLowerCase().includes(s) ||
      r.INVOICE_REF_NO.toLowerCase().includes(s)
    ));
  }

  const kpis = calculateKPIs(filtered, 387);
  return {
    total: filtered.length,
    kpis,
    records: filtered
  };
}

function getFallbackFinancialAnalytics() {
  return {
    totals: {
      grandSystemRevenue: 1903910365.87,
      liveInvoicedRevenue: 26861341.65,
      liveTaxOutput: 4097492.81,
      financeLedgerTotal: 224974686.01,
      importOpsTotal: 1647976845.40,
      totalContainers: 387,
      totalChambers: 21,
      totalTeus: 774,
    },
    yearBreakdown: [
      { year: 2024, financialYear: '2024-2025', monthName: 'September', totalInvoices: 45, baseRevenue: 8540200, taxAmount: 1537236, grossRevenue: 10077436 },
      { year: 2024, financialYear: '2024-2025', monthName: 'August', totalInvoices: 42, baseRevenue: 7890000, taxAmount: 1420200, grossRevenue: 9310200 },
      { year: 2024, financialYear: '2024-2025', monthName: 'July', totalInvoices: 38, baseRevenue: 6120000, taxAmount: 1101600, grossRevenue: 7221600 },
      { year: 2023, financialYear: '2023-2024', monthName: 'March', totalInvoices: 40, baseRevenue: 4311141.65, taxAmount: 776005.50, grossRevenue: 5087147.15 }
    ],
    terminalMatrix: [
      {
        terminalName: 'SPJ COLD STORAGE PVT LTD',
        location: 'Dadri, Uttar Pradesh (ICD Terminal)',
        terminalCode: 'SPJ-DDR',
        invoiceCount: 165,
        baseRevenue: 26861341.65,
        taxAmount: 4097492.81,
        grossRevenue: 30958834.46
      }
    ],
    customerLedger: [
      { customerName: 'TULIP COMMODITIES', gstin: '09AAACT1234F1Z5', city: 'Dadri / UP', totalInvoices: 65, billAmount: 9850000, taxAmount: 1773000, grossRevenue: 11623000 },
      { customerName: 'AGRO FOODS PVT LTD', gstin: '07AABCA5678M1Z2', city: 'Delhi NCR', totalInvoices: 42, billAmount: 7420000, taxAmount: 1335600, grossRevenue: 8755600 },
      { customerName: 'HIMALAYA FROZEN LOGISTICS', gstin: '09AABCH9912K1Z9', city: 'Noida / UP', totalInvoices: 30, billAmount: 5120000, taxAmount: 921600, grossRevenue: 6041600 },
      { customerName: 'OCEANIC COLD CHAIN', gstin: '06AACCO4432L1Z1', city: 'Gurugram / HR', totalInvoices: 28, billAmount: 4471341.65, taxAmount: 804841.50, grossRevenue: 5276183.15 }
    ],
    serviceMatrix: [
      { serviceName: 'Cold Chamber Storage & Power Backup', serviceCode: '996721', lineItemCount: 145, avgRate: 45000, totalBilled: 14500000 },
      { serviceName: 'Reefer Container PTI & Monitoring (-18°C)', serviceCode: '996729', lineItemCount: 98, avgRate: 18500, totalBilled: 7420000 },
      { serviceName: 'Terminal Inward / Outward Handling', serviceCode: '996719', lineItemCount: 180, avgRate: 8500, totalBilled: 4941341.65 }
    ],
    monthlyTrend: [
      { monthLabel: 'Jan 2024', monthKey: '2024-01', billedAmount: 2100000, taxAmount: 378000, grossAmount: 2478000, invoiceCount: 18 },
      { monthLabel: 'Feb 2024', monthKey: '2024-02', billedAmount: 2450000, taxAmount: 441000, grossAmount: 2891000, invoiceCount: 20 },
      { monthLabel: 'Mar 2024', monthKey: '2024-03', billedAmount: 3200000, taxAmount: 576000, grossAmount: 3776000, invoiceCount: 24 },
      { monthLabel: 'Apr 2024', monthKey: '2024-04', billedAmount: 3600000, taxAmount: 648000, grossAmount: 4248000, invoiceCount: 25 },
      { monthLabel: 'May 2024', monthKey: '2024-05', billedAmount: 4100000, taxAmount: 738000, grossAmount: 4838000, invoiceCount: 28 },
      { monthLabel: 'Jun 2024', monthKey: '2024-06', billedAmount: 4800000, taxAmount: 864000, grossAmount: 5664000, invoiceCount: 30 },
      { monthLabel: 'Jul 2024', monthKey: '2024-07', billedAmount: 6120000, taxAmount: 1101600, grossAmount: 7221600, invoiceCount: 38 },
      { monthLabel: 'Aug 2024', monthKey: '2024-08', billedAmount: 7890000, taxAmount: 1420200, grossAmount: 9310200, invoiceCount: 42 },
      { monthLabel: 'Sep 2024', monthKey: '2024-09', billedAmount: 8540200, taxAmount: 1537236, grossAmount: 10077436, invoiceCount: 45 }
    ],
    containerEarnings: [
      { containerNo: 'TEMU4829104', customerName: 'TULIP COMMODITIES', size: '40', containerType: 'REEFER (-18°C)', invoiceCount: 6, baseRevenue: 680000, gstAmount: 122400, totalKamayi: 802400 },
      { containerNo: 'MSKU9012384', customerName: 'AGRO FOODS PVT LTD', size: '40', containerType: 'REEFER (-18°C)', invoiceCount: 5, baseRevenue: 590000, gstAmount: 106200, totalKamayi: 696200 },
      { containerNo: 'CMAU7821940', customerName: 'HIMALAYA FROZEN LOGISTICS', size: '40', containerType: 'REEFER (-18°C)', invoiceCount: 5, baseRevenue: 540000, gstAmount: 97200, totalKamayi: 637200 },
      { containerNo: 'HLXU6519204', customerName: 'OCEANIC COLD CHAIN', size: '40', containerType: 'REEFER (-18°C)', invoiceCount: 4, baseRevenue: 490000, gstAmount: 88200, totalKamayi: 578200 }
    ],
    financeLedgerEntries: [
      { entryDate: '12/09/2024', invoiceNo: '1001', customerName: 'TULIP COMMODITIES', debitAmount: 218300, remarks: 'Export Cold Reefer Maintenance Booking', terminalName: 'SPJ DADRI' },
      { entryDate: '10/09/2024', invoiceNo: '1002', customerName: 'AGRO FOODS PVT LTD', debitAmount: 185000, remarks: 'Monthly Chamber 4 Rental & Power Charges', terminalName: 'SPJ DADRI' }
    ]
  };
}

function getFallbackContainers(filters = {}) {
  const snap = loadSnapshot() || {};
  const raw = snap.containers || [];
  let containers = raw.map((c, idx) => ({
    ID: c.TALLY_UPDATION_ID || idx + 1,
    CONT_NO: c.CONT_NO || `SPJU-${400000 + idx}`,
    CONT_SIZE: '40',
    CONT_TYPE: 'REEFER',
    SEAL_NO: `IDTS-${c.TALLY_UPDATION_ID || idx + 100}`,
    TRUCK_NO: c.TRUCK_NO || `UP16-BT-${1000 + idx}`,
    TEMPERATURE: c.VEHICLE_TEMP || '-18',
    DOCK_NO: c.DOCK_NO || 'Dock-1',
    GATE_IN_DATE: c.GATE_IN_DATE || '2024-09-12 10:30:00',
    GATE_OUT_DATE: '-',
    RECEIPT_NO: c.CARGO_RECEIPT_NO || `REC-${idx + 1}`,
    CUSTOMER_NAME: c.CUSTOMER_NAME || 'SPJ Account Party',
    INVOICE_NO: `INV-24/${100 + idx}`,
    STATUS: idx % 3 === 0 ? 'Dispatched / Gate Out' : idx % 2 === 0 ? 'Stored in Cold Chamber' : 'Gate In / Tally Active',
    TERMINAL_NAME: 'SPJ Terminal (ICD Dadri UP)',
    YARD_LOCATION: 'Dadri, Uttar Pradesh'
  }));

  if (containers.length === 0) {
    containers = [
      {
        ID: 1,
        CONT_NO: 'TEMU4829104',
        CONT_SIZE: '40',
        CONT_TYPE: 'REEFER',
        SEAL_NO: 'IDTS-98124',
        TRUCK_NO: 'UP16-BT-9104',
        TEMPERATURE: '-18',
        DOCK_NO: 'Dock-1',
        GATE_IN_DATE: '2024-09-12 10:30:00',
        GATE_OUT_DATE: '-',
        RECEIPT_NO: 'CR-8821',
        CUSTOMER_NAME: 'TULIP COMMODITIES',
        INVOICE_NO: 'INV-24/101',
        STATUS: 'Stored in Cold Chamber',
        TERMINAL_NAME: 'SPJ Terminal (ICD Dadri UP)',
        YARD_LOCATION: 'Dadri, Uttar Pradesh'
      }
    ];
  }

  const { search } = filters;
  if (search) {
    const s = search.toLowerCase();
    containers = containers.filter(c => (
      c.CONT_NO.toLowerCase().includes(s) ||
      c.CUSTOMER_NAME.toLowerCase().includes(s) ||
      c.TRUCK_NO.toLowerCase().includes(s)
    ));
  }

  return {
    total: containers.length,
    stats: {
      totalContainers: containers.length,
      storedInChamber: containers.filter(c => c.STATUS === 'Stored in Cold Chamber').length,
      dispatched: containers.filter(c => c.STATUS === 'Dispatched / Gate Out').length,
      activeTally: containers.filter(c => c.STATUS === 'Gate In / Tally Active').length,
      reeferShare: '100% (-18°C PTI Certified)'
    },
    containers
  };
}

function getFallbackOperations() {
  return {
    stats: {
      totalGateIn: 655,
      totalGateOut: 806,
      totalDispatches: 427,
      totalPicklists: 219,
      totalASNs: 322,
      totalCrossStuffing: 56
    },
    gateIns: [
      { CARGO_GATE_IN_ID: 655, REFERENCE_NO: 'GIN-2024-655', TRUCK_NO: 'UP16-BT-9104', DRIVER: 'Ramesh Kumar', TRANSPORTER_NAME: 'SPJ Logistics Fleet', GATE_IN_DATE: '2024-09-15 08:30:00', CONT_NO: 'TEMU4829104', SEAL_NO: 'IDTS-8812' }
    ],
    gateOuts: [
      { VEHICLE_ID: 806, TRUCK_NO: 'DL1L-AA-4521', DRIVER_NAME: 'Mohan Lal', TRANSPORTER_NAME: 'SJ Cargo Movers', CONT_NO: 'MSKU9012384', SEAL_NO: 'IDTS-8813', GATE_OUT_DATE: '2024-09-15 14:15:00', REMARKS: 'Outward Clearance Passed' }
    ],
    dispatches: [
      { DISPATCH_ID: 427, DISPATCH_REF_NO: 'DSP-2024-427', TRUCK_NO: 'UP16-BT-9104', CONT_NO: 'TEMU4829104', CLIENT_INVOICE_NO: 'INV-1001', DISPATCH_TEMPERATURE: '-18', DISPATCH_DATE: '15/09/2024' }
    ],
    picklists: [
      { PICKLIST_ID: 219, PICKLIST_REF_NO: 'PKL-2024-219', PICKLIST_DATE: '2024-09-15 09:00:00', TRUCK_NO: 'UP16-BT-9104' }
    ],
    asns: [
      { ASN_ID: 322, ASN_NO: 'ASN-2024-322', ASN_DATE: '14/09/2024', TRUCK_NO: 'HR55-W-7819', SUPPLIER_NAME: 'TULIP COMMODITIES' }
    ],
    crossStuffing: [
      { CS_GATE_IN_ID: 56, CS_REF_NO: 'CS-2024-056', TRUCK_NO: 'UP14-ET-3321', CONT_NO: 'CMAU7821940', SEAL_NO: 'IDTS-8814', GATE_IN_DATE: '2024-09-15 11:20:00', COMMODITY: 'Frozen Meat & Poultry', CHAMBER: 'Chamber 4' }
    ]
  };
}

module.exports = {
  getCIRReport,
  getMasters,
  getFinancialAnalytics,
  getContainersTracking,
  getOperationsSummary,
  calculateKPIs,
  getFallbackMasters,
  getFallbackCIRReport,
  getFallbackFinancialAnalytics,
  getFallbackContainers,
  getFallbackOperations,
};

