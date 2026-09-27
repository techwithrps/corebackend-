# SPJ Cargo & Logistics Backend API

Enterprise backend server for SPJ Cargo & Logistics Intelligence Platform. Integrates directly with Oracle `SPJLIVE` via a high-performance Java JDBC bridge (`OracleAnalyticsEngine.java` + `ojdbc11.jar`).

## ⚙️ Key Highlights
- **100% Live Oracle SPJLIVE Data:** Stored procedure `REPORT_PKG.SP_INVOICE_REPORT_NEW`, `IMP_INVOICE`, `IMP_INVOICE_ITEMS`, `IMP_INVOICE_TAX`, `ALL_PARTY_ACCOUNT`, and masters.
- **MSSQL completely removed:** Oracle is the single source of truth.
- **Native Network Encryption Supported:** Powered by OpenJDK + `ojdbc11.jar` to comply with enterprise Oracle network encryption policies.
- **Docker & Cloud Ready:** Pre-configured with `Dockerfile`, `railway.json`, and `render.yaml`.

## 📦 Quick Start (Local)

### Prerequisites
- Node.js 18+ or 20+
- Java JDK 17+ or 21+ (`java` and `javac` must be in PATH)

### 1. Install & Build
```bash
npm install
npm run build     # Compiles OracleAnalyticsEngine.java and OracleWarehouseExporter.java
```

### 2. Configure Environment (.env)
```env
PORT=5001
ORACLE_HOST=144.24.138.129
ORACLE_PORT=1521
ORACLE_SERVICE_NAME=pdb1.sub06121018360.prodvcn.oraclevcn.com
ORACLE_USER=SPJLIVE
ORACLE_PASSWORD=SPjlive_0112#
ORACLE_JDBC_URL=jdbc:oracle:thin:@//144.24.138.129:1521/pdb1.sub06121018360.prodvcn.oraclevcn.com
FRONTEND_URL=https://spj-mauve.vercel.app
```

### 3. Run Server
```bash
npm start         # Starts express server on port 5001
# Or for live-reload dev:
npm run dev
```

## 🚀 Cloud Deployment

See [DEPLOYMENT.md](../DEPLOYMENT.md) for full deployment instructions for **Railway**, **Render**, **AWS EC2**, and **Docker**.
