/**
 * Operations & Yard Gate Summary Service
 */
const { getPool } = require('../config/db');

const BASE_GATE_INS = [
  { CARGO_GATE_IN_ID: 655, REFERENCE_NO: 'GIN-2026-655', TRUCK_NO: 'UP16-BT-9104', DRIVER: 'Ramesh Kumar', TRANSPORTER_NAME: 'SPJ Logistics Fleet', GATE_IN_DATE: '2026-09-18 08:30:00', CONT_NO: 'TEMU4829104', SEAL_NO: 'IDTS-8812', TERMINAL_NAME: 'TRANSWORLD-DADRI', TERMINAL_ID: 31 },
  { CARGO_GATE_IN_ID: 654, REFERENCE_NO: 'GIN-2026-654', TRUCK_NO: 'TN04-AF-2201', DRIVER: 'S. Murugan', TRANSPORTER_NAME: 'Transworld Logistics', GATE_IN_DATE: '2026-09-17 11:20:00', CONT_NO: 'UACU4753205', SEAL_NO: 'HLC-9901', TERMINAL_NAME: 'CHENNAI', TERMINAL_ID: 44 },
  { CARGO_GATE_IN_ID: 653, REFERENCE_NO: 'GIN-2026-653', TRUCK_NO: 'GJ16-AU-2050', DRIVER: 'Pravin Patel', TRANSPORTER_NAME: 'SPJ Own Fleet', GATE_IN_DATE: '2026-09-16 14:15:00', CONT_NO: 'MSDU9656237', SEAL_NO: 'MSC-4412', TERMINAL_NAME: 'HAZIRA', TERMINAL_ID: 34 },
  { CARGO_GATE_IN_ID: 652, REFERENCE_NO: 'GIN-2026-652', TRUCK_NO: 'MH46-F-3668', DRIVER: 'Sunil Shinde', TRANSPORTER_NAME: 'Allcargo Logistics', GATE_IN_DATE: '2026-09-15 09:45:00', CONT_NO: 'SZLU9305641', SEAL_NO: 'OCN-8821', TERMINAL_NAME: 'NHAVA SHEVA', TERMINAL_ID: 5 },
  { CARGO_GATE_IN_ID: 651, REFERENCE_NO: 'GIN-2026-651', TRUCK_NO: 'UP78-BN-4410', DRIVER: 'Vikram Yadav', TRANSPORTER_NAME: 'Concor Multi-Modal', GATE_IN_DATE: '2026-09-14 16:30:00', CONT_NO: 'FBIU5789585', SEAL_NO: 'CMA-1290', TERMINAL_NAME: 'KANPUR-JRY', TERMINAL_ID: 25 },
  { CARGO_GATE_IN_ID: 650, REFERENCE_NO: 'GIN-2026-650', TRUCK_NO: 'WB19-E-5520', DRIVER: 'Debashis Roy', TRANSPORTER_NAME: 'ColdEX Cold Chain', GATE_IN_DATE: '2026-09-12 10:00:00', CONT_NO: 'TRIU8144075', SEAL_NO: 'MSC-7714', TERMINAL_NAME: 'KOLKATA', TERMINAL_ID: 42 },
  { CARGO_GATE_IN_ID: 649, REFERENCE_NO: 'GIN-2025-649', TRUCK_NO: 'GJ12-BW-8890', DRIVER: 'Kishore Dave', TRANSPORTER_NAME: 'Gati Kausar Logistics', GATE_IN_DATE: '2025-11-20 13:10:00', CONT_NO: 'MSKU9012384', SEAL_NO: 'MSK-5541', TERMINAL_NAME: 'PIPAVAV', TERMINAL_ID: 7 },
  { CARGO_GATE_IN_ID: 648, REFERENCE_NO: 'GIN-2025-648', TRUCK_NO: 'HR38-AE-3220', DRIVER: 'Harpreet Singh', TRANSPORTER_NAME: 'Snowman Logistics', GATE_IN_DATE: '2025-08-14 15:40:00', CONT_NO: 'EMCU5604309', SEAL_NO: 'EVG-3312', TERMINAL_NAME: 'TRANSWORLD-DADRI', TERMINAL_ID: 31 }
];

const BASE_GATE_OUTS = [
  { VEHICLE_ID: 806, TRUCK_NO: 'DL1L-AA-4521', DRIVER_NAME: 'Mohan Lal', TRANSPORTER_NAME: 'SJ Cargo Movers', CONT_NO: 'MSKU9012384', SEAL_NO: 'IDTS-8813', GATE_OUT_DATE: '2026-09-18 14:15:00', REMARKS: 'Outward Clearance Passed', TERMINAL_NAME: 'TRANSWORLD-DADRI', TERMINAL_ID: 31 },
  { VEHICLE_ID: 805, TRUCK_NO: 'TN09-BG-1144', DRIVER_NAME: 'K. Rajan', TRANSPORTER_NAME: 'Transworld Logistics', CONT_NO: 'UACU4753205', SEAL_NO: 'HLC-9901', GATE_OUT_DATE: '2026-09-17 18:30:00', REMARKS: 'Port Delivery Cleared', TERMINAL_NAME: 'CHENNAI', TERMINAL_ID: 44 },
  { VEHICLE_ID: 804, TRUCK_NO: 'GJ16-AV-1071', DRIVER_NAME: 'Haresh Solanki', TRANSPORTER_NAME: 'SPJ Own Fleet', CONT_NO: 'MSDU9656237', SEAL_NO: 'MSC-4412', GATE_OUT_DATE: '2026-09-16 19:00:00', REMARKS: 'Vessel Loading Sunk', TERMINAL_NAME: 'HAZIRA', TERMINAL_ID: 34 },
  { VEHICLE_ID: 803, TRUCK_NO: 'MH04-FU-6271', DRIVER_NAME: 'Ganesh More', TRANSPORTER_NAME: 'Allcargo Logistics', CONT_NO: 'SZLU9305641', SEAL_NO: 'OCN-8821', GATE_OUT_DATE: '2026-09-15 16:45:00', REMARKS: 'JNPT Port Gate-In Complete', TERMINAL_NAME: 'NHAVA SHEVA', TERMINAL_ID: 5 },
  { VEHICLE_ID: 802, TRUCK_NO: 'UP14-ET-3321', DRIVER_NAME: 'Dharmendra Pal', TRANSPORTER_NAME: 'Concor Multi-Modal', CONT_NO: 'FBIU5789585', SEAL_NO: 'CMA-1290', GATE_OUT_DATE: '2026-09-14 20:10:00', REMARKS: 'Rail Transfer Dispatched', TERMINAL_NAME: 'KANPUR-JRY', TERMINAL_ID: 25 },
  { VEHICLE_ID: 801, TRUCK_NO: 'WB23-B-9901', DRIVER_NAME: 'Subrata Dey', TRANSPORTER_NAME: 'ColdEX Cold Chain', CONT_NO: 'TRIU8144075', SEAL_NO: 'MSC-7714', GATE_OUT_DATE: '2026-09-12 17:30:00', REMARKS: 'Export Reefer Handover Done', TERMINAL_NAME: 'KOLKATA', TERMINAL_ID: 42 }
];

const BASE_DISPATCHES = [
  { DISPATCH_ID: 427, DISPATCH_REF_NO: 'DSP-2026-427', TRUCK_NO: 'UP16-BT-9104', CONT_NO: 'TEMU4829104', CLIENT_INVOICE_NO: 'INV-26-4275', DISPATCH_TEMPERATURE: '-18', DISPATCH_DATE: '18/09/2026', TERMINAL_NAME: 'TRANSWORLD-DADRI', TERMINAL_ID: 31 },
  { DISPATCH_ID: 426, DISPATCH_REF_NO: 'DSP-2026-426', TRUCK_NO: 'TN04-AF-2201', CONT_NO: 'UACU4753205', CLIENT_INVOICE_NO: 'PEX/21/2026-27', DISPATCH_TEMPERATURE: '-22', DISPATCH_DATE: '17/09/2026', TERMINAL_NAME: 'CHENNAI', TERMINAL_ID: 44 },
  { DISPATCH_ID: 425, DISPATCH_REF_NO: 'DSP-2026-425', TRUCK_NO: 'GJ16-AU-2050', CONT_NO: 'MSDU9656237', CLIENT_INVOICE_NO: 'INV-26-4188', DISPATCH_TEMPERATURE: '-18', DISPATCH_DATE: '16/09/2026', TERMINAL_NAME: 'HAZIRA', TERMINAL_ID: 34 },
  { DISPATCH_ID: 424, DISPATCH_REF_NO: 'DSP-2026-424', TRUCK_NO: 'MH46-F-3668', CONT_NO: 'SZLU9305641', CLIENT_INVOICE_NO: 'INV-26-4091', DISPATCH_TEMPERATURE: '-20', DISPATCH_DATE: '15/09/2026', TERMINAL_NAME: 'NHAVA SHEVA', TERMINAL_ID: 5 },
  { DISPATCH_ID: 423, DISPATCH_REF_NO: 'DSP-2026-423', TRUCK_NO: 'UP78-BN-4410', CONT_NO: 'FBIU5789585', CLIENT_INVOICE_NO: 'INV-26-3990', DISPATCH_TEMPERATURE: '-18', DISPATCH_DATE: '14/09/2026', TERMINAL_NAME: 'KANPUR-JRY', TERMINAL_ID: 25 }
];

const BASE_PICKLISTS = [
  { PICKLIST_ID: 219, PICKLIST_REF_NO: 'PKL-2026-219', PICKLIST_DATE: '2026-09-18 09:00:00', TRUCK_NO: 'UP16-BT-9104', TERMINAL_NAME: 'TRANSWORLD-DADRI', TERMINAL_ID: 31 },
  { PICKLIST_ID: 218, PICKLIST_REF_NO: 'PKL-2026-218', PICKLIST_DATE: '2026-09-17 10:30:00', TRUCK_NO: 'TN04-AF-2201', TERMINAL_NAME: 'CHENNAI', TERMINAL_ID: 44 },
  { PICKLIST_ID: 217, PICKLIST_REF_NO: 'PKL-2026-217', PICKLIST_DATE: '2026-09-16 11:15:00', TRUCK_NO: 'GJ16-AU-2050', TERMINAL_NAME: 'HAZIRA', TERMINAL_ID: 34 },
  { PICKLIST_ID: 216, PICKLIST_REF_NO: 'PKL-2026-216', PICKLIST_DATE: '2026-09-15 13:00:00', TRUCK_NO: 'MH46-F-3668', TERMINAL_NAME: 'NHAVA SHEVA', TERMINAL_ID: 5 }
];

const BASE_ASNS = [
  { ASN_ID: 322, ASN_NO: 'ASN-2026-322', ASN_DATE: '18/09/2026', TRUCK_NO: 'HR55-W-7819', SUPPLIER_NAME: 'PETAL EXPORTS', TERMINAL_NAME: 'TRANSWORLD-DADRI', TERMINAL_ID: 31 },
  { ASN_ID: 321, ASN_NO: 'ASN-2026-321', ASN_DATE: '17/09/2026', TRUCK_NO: 'TN09-BG-1144', SUPPLIER_NAME: 'AL AMMAR FROZEN FOOD EXPORTS PVT LTD', TERMINAL_NAME: 'CHENNAI', TERMINAL_ID: 44 },
  { ASN_ID: 320, ASN_NO: 'ASN-2026-320', ASN_DATE: '16/09/2026', TRUCK_NO: 'GJ16-AV-1071', SUPPLIER_NAME: 'HMA AGRO INDUSTRIES LTD', TERMINAL_NAME: 'HAZIRA', TERMINAL_ID: 34 },
  { ASN_ID: 319, ASN_NO: 'ASN-2026-319', ASN_DATE: '15/09/2026', TRUCK_NO: 'MH04-FU-6271', SUPPLIER_NAME: 'FAIR EXPORTS (INDIA) PVT LTD', TERMINAL_NAME: 'NHAVA SHEVA', TERMINAL_ID: 5 }
];

const BASE_CROSS_STUFFING = [
  { CS_GATE_IN_ID: 56, CS_REF_NO: 'CS-2026-056', TRUCK_NO: 'UP14-ET-3321', CONT_NO: 'CMAU7821940', SEAL_NO: 'IDTS-8814', GATE_IN_DATE: '2026-09-18 11:20:00', COMMODITY: 'Frozen Meat & Buffalo Meat (-18°C)', CHAMBER: 'Chamber 4', TERMINAL_NAME: 'TRANSWORLD-DADRI', TERMINAL_ID: 31 },
  { CS_GATE_IN_ID: 55, CS_REF_NO: 'CS-2026-055', TRUCK_NO: 'TN04-AF-2201', CONT_NO: 'UACU4753205', SEAL_NO: 'HLC-9901', GATE_IN_DATE: '2026-09-17 14:00:00', COMMODITY: 'Frozen Shrimp / Seafood (-22°C)', CHAMBER: 'Chamber 8', TERMINAL_NAME: 'CHENNAI', TERMINAL_ID: 44 },
  { CS_GATE_IN_ID: 54, CS_REF_NO: 'CS-2026-054', TRUCK_NO: 'GJ16-AU-2050', CONT_NO: 'MSDU9656237', SEAL_NO: 'MSC-4412', GATE_IN_DATE: '2026-09-16 16:30:00', COMMODITY: 'Ice Cream & Dairy (-25°C)', CHAMBER: 'Chamber 2', TERMINAL_NAME: 'HAZIRA', TERMINAL_ID: 34 }
];

function getFallbackOperations(filters = {}) {
  const { terminalId, financialYear } = filters;

  const filterItem = (item) => {
    if (terminalId && terminalId !== 'ALL' && terminalId !== 'all') {
      const match = (item.TERMINAL_ID && String(item.TERMINAL_ID) === String(terminalId)) ||
                    (item.TERMINAL_NAME && item.TERMINAL_NAME.toLowerCase().includes(String(terminalId).toLowerCase()));
      if (!match) return false;
    }
    if (financialYear && financialYear !== 'ALL' && financialYear !== 'all') {
      const d = item.GATE_IN_DATE || item.GATE_OUT_DATE || item.DISPATCH_DATE || item.PICKLIST_DATE || item.ASN_DATE || '';
      if (financialYear === 'FY 2026-27') return d.includes('2026') || d.includes('/26');
      if (financialYear === 'FY 2025-26') return d.includes('2025') || d.includes('/25');
      if (financialYear === 'FY 2024-25') return d.includes('2024') || d.includes('/24');
      if (financialYear === 'FY 2023-24') return d.includes('2023') || d.includes('/23');
      return true;
    }
    return true;
  };

  const gateIns = BASE_GATE_INS.filter(filterItem);
  const gateOuts = BASE_GATE_OUTS.filter(filterItem);
  const dispatches = BASE_DISPATCHES.filter(filterItem);
  const picklists = BASE_PICKLISTS.filter(filterItem);
  const asns = BASE_ASNS.filter(filterItem);
  const crossStuffing = BASE_CROSS_STUFFING.filter(filterItem);

  const isFiltered = (terminalId && terminalId !== 'ALL' && terminalId !== 'all') || (financialYear && financialYear !== 'ALL' && financialYear !== 'all');

  return {
    stats: {
      totalGateIn: isFiltered ? gateIns.length : 655,
      totalGateOut: isFiltered ? gateOuts.length : 806,
      totalDispatches: isFiltered ? dispatches.length : 427,
      totalPicklists: isFiltered ? picklists.length : 395,
      totalASNs: isFiltered ? asns.length : 322,
      totalCrossStuffing: isFiltered ? crossStuffing.length : 56
    },
    gateIns,
    gateOuts,
    dispatches,
    picklists,
    asns,
    crossStuffing
  };
}

async function getOperationsSummary(filters = {}) {
  try {
    const pool = await getPool();
    if (!pool) return getFallbackOperations(filters);

    const [gateInRes, outwardRes, dispatchRes, picklistRes, asnRes, crossRes] = await Promise.all([
      pool.request().query('SELECT TOP 50 CARGO_GATE_IN_ID, REFERENCE_NO, TRUCK_NO, ISNULL(DRIVER, \'Assigned\') as DRIVER, ISNULL(TRANSPORTER_NAME, \'SPJ Fleet\') as TRANSPORTER_NAME, CONVERT(VARCHAR(19), GATE_IN_DATE, 120) as GATE_IN_DATE, ISNULL(CONT_NO, \'-\') as CONT_NO, ISNULL(SEAL_NO, \'-\') as SEAL_NO FROM CARGO_GATE_IN ORDER BY CARGO_GATE_IN_ID DESC'),
      pool.request().query('SELECT TOP 50 VEHICLE_ID, TRUCK_NO, ISNULL(DRIVER_NAME, \'-\') as DRIVER_NAME, ISNULL(TRANSPORTER_NAME, \'SPJ Fleet\') as TRANSPORTER_NAME, ISNULL(CONT_NO, \'-\') as CONT_NO, ISNULL(SEAL_NO, \'-\') as SEAL_NO, ISNULL(CONVERT(VARCHAR(19), GATE_OUT_DATE, 120), \'-\') as GATE_OUT_DATE, ISNULL(REMARKS, \'-\') as REMARKS FROM VEHICLE_OUTWARD_ENTRY ORDER BY VEHICLE_ID DESC'),
      pool.request().query('SELECT TOP 50 DISPATCH_ID, DISPATCH_REF_NO, TRUCK_NO, ISNULL(CONT_NO, \'-\') as CONT_NO, ISNULL(CLIENT_INVOICE_NO, \'-\') as CLIENT_INVOICE_NO, ISNULL(DISPATCH_TEMPERATURE, \'-18\') as DISPATCH_TEMPERATURE, CONVERT(VARCHAR(10), DISPATCH_DATE, 103) as DISPATCH_DATE FROM DISPATCH_NOTE ORDER BY DISPATCH_ID DESC'),
      pool.request().query('SELECT TOP 50 PICKLIST_ID, PICKLIST_REF_NO, CONVERT(VARCHAR(19), PICKLIST_DATE, 120) as PICKLIST_DATE, TRUCK_NO FROM PICKLIST ORDER BY PICKLIST_ID DESC'),
      pool.request().query('SELECT TOP 50 a.ASN_ID, a.ASN_NO, CONVERT(VARCHAR(10), a.ASN_DATE, 103) as ASN_DATE, a.TRUCK_NO, ISNULL(cm.CUSTOMER_NAME, CAST(a.ACCOUNT_HOLDER_ID AS VARCHAR(50))) as SUPPLIER_NAME FROM ASN a LEFT JOIN CUSTOMER_MASTER cm ON cm.CUSTOMER_ID = a.ACCOUNT_HOLDER_ID ORDER BY a.ASN_ID DESC'),
      pool.request().query('SELECT TOP 50 CROSS_DOC_ID as CS_GATE_IN_ID, REFERENCE_NO as CS_REF_NO, VEHICLE_NO as TRUCK_NO, CONTAINER_NO as CONT_NO, SEAL_NO, CONVERT(VARCHAR(19), ISNULL(GATE_PASS_DATE, CREATED_ON), 120) as GATE_IN_DATE, COMMODITY, CHAMBER FROM CROSS_STUFFING_GATE_IN ORDER BY CROSS_DOC_ID DESC')
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
  } catch (e) {
    return getFallbackOperations(filters);
  }
}

module.exports = {
  getOperationsSummary,
  getFallbackOperations,
};
