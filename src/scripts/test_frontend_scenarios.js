const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5001${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runScenarios() {
  const testCases = [
    {
      name: 'CASE 1: FY 2025-26, Company=ALL, Customer=ALL, Terminal=ALL',
      finPath: '/api/financial-analytics?financialYear=FY%202025-26',
      cirPath: '/api/cir-report?financialYear=FY%202025-26&page=1&limit=50'
    },
    {
      name: 'CASE 2: Custom 2-Day (2026-09-01 -> 2026-09-02)',
      finPath: '/api/financial-analytics?fromDate=2026-09-01&toDate=2026-09-02',
      cirPath: '/api/cir-report?fromDate=2026-09-01&toDate=2026-09-02&page=1&limit=50'
    },
    {
      name: 'CASE 3: Custom 30-Day (2026-09-01 -> 2026-09-30)',
      finPath: '/api/financial-analytics?fromDate=2026-09-01&toDate=2026-09-30',
      cirPath: '/api/cir-report?fromDate=2026-09-01&toDate=2026-09-30&page=1&limit=50'
    },
    {
      name: 'CASE 4: Company + Customer',
      finPath: '/api/financial-analytics?companyId=2&customerId=COSTA%20CONTAINER%20LINES',
      cirPath: '/api/cir-report?companyId=2&customerId=COSTA%20CONTAINER%20LINES&page=1&limit=50'
    },
    {
      name: 'CASE 5: Company + Customer + Terminal',
      finPath: '/api/financial-analytics?companyId=2&customerId=COSTA%20CONTAINER%20LINES&terminalId=1',
      cirPath: '/api/cir-report?companyId=2&customerId=COSTA%20CONTAINER%20LINES&terminalId=1&page=1&limit=50'
    },
    {
      name: 'CASE 6: Company + Customer + Terminal + Custom Date Range',
      finPath: '/api/financial-analytics?companyId=2&customerId=COSTA%20CONTAINER%20LINES&terminalId=1&fromDate=2026-04-01&toDate=2026-09-26',
      cirPath: '/api/cir-report?companyId=2&customerId=COSTA%20CONTAINER%20LINES&terminalId=1&fromDate=2026-04-01&toDate=2026-09-26&page=1&limit=50'
    }
  ];

  console.log('===========================================================');
  console.log('STARTING FRONTEND-BACKEND ANALYTICS SYNCHRONIZATION VERIFICATION');
  console.log('===========================================================\n');

  for (const tc of testCases) {
    console.log(`--- ${tc.name} ---`);
    try {
      const [finRes, cirRes] = await Promise.all([
        makeRequest(tc.finPath),
        makeRequest(tc.cirPath)
      ]);

      if (!finRes.success || !cirRes.success) {
        console.error('❌ Request failed:', finRes.error || cirRes.error);
        continue;
      }

      const finKpis = finRes.data.kpis;
      const cirKpis = cirRes.kpis;

      const finGross = finKpis.totalGrossAmount;
      const cirGross = cirKpis.totalGrossAmount;

      const finInvs = finKpis.invoiceCount;
      const cirInvs = cirKpis.totalRecords;

      const finConts = finKpis.containerCount;
      const cirConts = cirKpis.containerCount;

      console.log(`Financial Analytics KPIs: Revenue ₹${finGross.toLocaleString()}, Invoices: ${finInvs}, Containers: ${finConts}, TEUs: ${finKpis.teuCount}`);
      console.log(`CIR Report KPIs:          Revenue ₹${cirGross.toLocaleString()}, Records: ${cirInvs}, Containers: ${cirConts}, TEUs: ${cirKpis.teuCount}`);
      console.log(`Top Customers Count: ${finRes.data.topCustomers.length}, Top Services Count: ${finRes.data.topServices.length}, Branch Count: ${finRes.data.terminalAnalytics.length}`);

      const matchGross = Math.abs(finGross - cirGross) < 0.01;
      const matchInvs = finInvs === cirInvs;
      const matchConts = finConts === cirConts;

      if (matchGross && matchInvs && matchConts) {
        console.log('✅ PERFECT SYNCHRONIZATION MATCH!\n');
      } else {
        console.error('❌ MISMATCH DETECTED!\n');
      }
    } catch (e) {
      console.error('❌ Error executing test scenario:', e.message, '\n');
    }
  }
}

runScenarios();
