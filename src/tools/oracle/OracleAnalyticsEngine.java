import java.sql.*;
import java.io.*;
import java.util.*;
import oracle.jdbc.OracleTypes;

/**
 * OracleAnalyticsEngine
 * Real-time query engine for SPJ Cargo Intelligence.
 * Supports multiple modes:
 *   mode=invoice     -> REPORT_PKG.SP_INVOICE_REPORT_NEW stored procedure (CIR report + financial analytics)
 *   mode=containers  -> ALL_PARTY_ACCOUNT container tracking
 *   mode=fleet       -> FLEET_EQUIPMENT_MASTER own fleet equipment
 *   mode=masters     -> TERMINAL_MASTER / CUSTOMER_MASTER / SERVICE_MASTER
 *
 * All data is fetched LIVE from Oracle SPJLIVE. No snapshots, no hardcoded values.
 */
public class OracleAnalyticsEngine {
    private static String escapeJson(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\b': sb.append("\\b"); break;
                case '\f': sb.append("\\f"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 32 || c >= 127) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }

    private static String formatDateToDDMMYYYY(String dateStr) {
        if (dateStr == null || dateStr.trim().isEmpty() || dateStr.equals("null")) return null;
        String s = dateStr.trim();
        if (s.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
            String[] p = s.split("-");
            return p[2] + "/" + p[1] + "/" + p[0];
        }
        if (s.matches("^\\d{2}/\\d{2}/\\d{4}$")) {
            return s;
        }
        return s;
    }

    private static String fmtDate(java.sql.Date d) {
        if (d == null) return null;
        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("dd/MM/yyyy");
        return sdf.format(d);
    }

    public static void main(String[] args) {
        String url = "jdbc:oracle:thin:@//144.24.138.129:1521/pdb1.sub06121018360.prodvcn.oraclevcn.com";
        String user = "SPJLIVE";
        String pass = "SPjlive_0112#";

        String mode = "invoice";
        String fromDate = null;
        String toDate = null;
        String companyIdStr = "2";
        String terminalIdStr = "5";
        String serviceTypeStr = "0";
        String customerIdStr = null;
        String search = null;
        String contNo = null;
        String blNo = null;
        String tripType = null;
        String size = null;
        String serviceId = null;
        boolean useStoredProc = true;
        int page = 1;
        int limit = 50;

        if (args.length > 0) {
            for (String arg : args) {
                if (arg.startsWith("mode=")) mode = arg.substring(5);
                else if (arg.startsWith("fromDate=")) fromDate = arg.substring(9);
                else if (arg.startsWith("toDate=")) toDate = arg.substring(7);
                else if (arg.startsWith("companyId=")) companyIdStr = arg.substring(10);
                else if (arg.startsWith("terminalId=")) terminalIdStr = arg.substring(11);
                else if (arg.startsWith("serviceType=")) serviceTypeStr = arg.substring(12);
                else if (arg.startsWith("customerId=")) customerIdStr = arg.substring(11);
                else if (arg.startsWith("search=")) search = arg.substring(7);
                else if (arg.startsWith("contNo=")) contNo = arg.substring(7);
                else if (arg.startsWith("blNo=")) blNo = arg.substring(5);
                else if (arg.startsWith("tripType=")) tripType = arg.substring(9);
                else if (arg.startsWith("size=")) size = arg.substring(5);
                else if (arg.startsWith("serviceId=")) serviceId = arg.substring(10);
                else if (arg.startsWith("useStoredProc=")) useStoredProc = Boolean.parseBoolean(arg.substring(14));
                else if (arg.startsWith("page=")) page = Integer.parseInt(arg.substring(5));
                else if (arg.startsWith("limit=")) limit = Integer.parseInt(arg.substring(6));
            }
        }

        long startTime = System.currentTimeMillis();

        try (Connection conn = DriverManager.getConnection(url, user, pass)) {
            switch (mode) {
                case "containers":
                    queryContainers(conn, terminalIdStr, customerIdStr, companyIdStr, search, contNo, blNo, tripType, size, page, limit, startTime);
                    break;
                case "fleet":
                    queryFleet(conn, terminalIdStr, search, page, limit, startTime);
                    break;
                case "masters":
                    queryMasters(conn, terminalIdStr, startTime);
                    break;
                case "kpis":
                    queryKPIs(conn, fromDate, toDate, terminalIdStr, companyIdStr, startTime);
                    break;
                case "invoice":
                default:
                    queryInvoice(conn, fromDate, toDate, companyIdStr, terminalIdStr, serviceTypeStr, customerIdStr, useStoredProc, page, limit, startTime);
                    break;
            }
        } catch (Exception e) {
            System.out.printf("{\"success\":false,\"error\":\"%s\"}\n", escapeJson(e.getMessage()));
        }
    }

    // ============================================================
    // KPI MODE (System-Wide Real-Time KPIs)
    // ============================================================
    private static void queryKPIs(Connection conn, String fromDate, String toDate,
            String terminalIdStr, String companyIdStr, long startTime) throws Exception {
        // Default to all-time if no date range provided
        if (fromDate == null || fromDate.isEmpty()) fromDate = "01/01/2000";
        if (toDate == null || toDate.isEmpty()) {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("dd/MM/yyyy");
            toDate = sdf.format(new java.util.Date());
        }
        String fDateFormatted = formatDateToDDMMYYYY(fromDate);
        String tDateFormatted = formatDateToDDMMYYYY(toDate);

        // 1. Financial KPIs from stored procedure (respects date range)
        double gross = 0, bill = 0, tax = 0, igst = 0, cgst = 0, sgst = 0;
        long invoices = 0, lineItems = 0;
        try {
            String callSql = "{call REPORT_PKG.SP_INVOICE_REPORT_NEW(?, ?, ?, ?, ?, ?)}";
            int tId = 5;
            try { if (terminalIdStr != null && !terminalIdStr.equalsIgnoreCase("all")) tId = Integer.parseInt(terminalIdStr); } catch (Exception e) {}
            int cId = 2;
            try { if (companyIdStr != null && !companyIdStr.equalsIgnoreCase("all")) cId = Integer.parseInt(companyIdStr); } catch (Exception e) {}
            try (CallableStatement cstmt = conn.prepareCall(callSql)) {
                cstmt.setInt(1, tId);
                cstmt.setInt(2, cId);
                cstmt.setString(3, fDateFormatted);
                cstmt.setString(4, tDateFormatted);
                cstmt.setString(5, "0");
                cstmt.registerOutParameter(6, OracleTypes.CURSOR);
                cstmt.execute();
                Set<String> uniqInv = new HashSet<>();
                try (ResultSet rs = (ResultSet) cstmt.getObject(6)) {
                    while (rs.next()) {
                        lineItems++;
                        uniqInv.add(rs.getString("INVOICE_NO"));
                        bill += rs.getDouble("AMOUNT");
                        igst += rs.getDouble("IGST");
                        cgst += rs.getDouble("CGST");
                        sgst += rs.getDouble("SGST");
                        gross += rs.getDouble("INVOICE_AMOUNT");
                    }
                }
                invoices = uniqInv.size();
            }
        } catch (Exception e) {
            System.out.printf("{\"success\":false,\"error\":\"%s\"}\n", escapeJson(e.getMessage()));
            return;
        }
        tax = igst + cgst + sgst;

        // 2. Container Movements & Job Orders from ALL_PARTY_ACCOUNT (respects date range)
        // Join with IMP_INVOICE to apply terminal/company/date filters consistently
        StringBuilder apaFilter = new StringBuilder();
        if (terminalIdStr != null && !terminalIdStr.isEmpty() && !terminalIdStr.equalsIgnoreCase("all")) {
            apaFilter.append(" AND I.TERMINAL_ID = ").append(terminalIdStr);
        }
        if (companyIdStr != null && !companyIdStr.isEmpty() && !companyIdStr.equalsIgnoreCase("all")) {
            apaFilter.append(" AND I.COMPANY_ID = ").append(companyIdStr);
        }
        apaFilter.append(" AND I.INVOICE_DATE >= TO_DATE('").append(fDateFormatted).append("','DD/MM/YYYY')");
        apaFilter.append(" AND I.INVOICE_DATE <= TO_DATE('").append(tDateFormatted).append("','DD/MM/YYYY')");

        String apaBase = "FROM SPJLIVE.ALL_PARTY_ACCOUNT AP " +
            "JOIN SPJLIVE.IMP_INVOICE I ON AP.CONT_JO_ID = I.LINE_ITEM_ID " +
            "WHERE AP.CONT_NO IS NOT NULL AND I.CANCLE_FLAGE IS NULL " + apaFilter;

        long containerMovements = 0, jobOrders = 0, physicalContainers = 0, teus = 0;
        try (Statement st = conn.createStatement()) {
            try (ResultSet rs = st.executeQuery(
                "SELECT COUNT(DISTINCT AP.CONT_NO) AS CNT " + apaBase)) {
                if (rs.next()) containerMovements = rs.getLong("CNT");
            }
            try (ResultSet rs = st.executeQuery(
                "SELECT COUNT(DISTINCT AP.CONT_JO_ID) AS CNT " + apaBase)) {
                if (rs.next()) jobOrders = rs.getLong("CNT");
            }
            try (ResultSet rs = st.executeQuery(
                "SELECT COUNT(DISTINCT AP.CONT_NO) AS CNT " + apaBase)) {
                if (rs.next()) physicalContainers = rs.getLong("CNT");
            }
            try (ResultSet rs = st.executeQuery(
                "SELECT SUM(CASE WHEN AP.CONT_SIZE='20' THEN 1 WHEN AP.CONT_SIZE='40' THEN 2 ELSE 0 END) AS TEU " + apaBase)) {
                if (rs.next()) teus = rs.getLong("TEU");
            }
        }

        long totalTime = System.currentTimeMillis() - startTime;
        System.out.printf(Locale.US,
            "{\"success\":true,\"source\":\"ORACLE_SPJLIVE_LIVE\",\"mode\":\"kpis\",\"totalTimeMs\":%d," +
            "\"kpis\":{\"totalGrossAmount\":%.2f,\"grossRevenue\":%.2f,\"netRevenue\":%.2f,\"totalBillAmount\":%.2f," +
            "\"totalTax\":%.2f,\"totalIgst\":%.2f,\"totalCgst\":%.2f,\"totalSgst\":%.2f," +
            "\"invoiceCount\":%d,\"lineItemCount\":%d,\"containerCount\":%d,\"containerMovements\":%d," +
            "\"jobOrders\":%d,\"teuCount\":%d,\"physicalContainers\":%d}}",
            totalTime, gross, gross, gross, bill, tax, igst, cgst, sgst,
            invoices, lineItems, physicalContainers, containerMovements, jobOrders, teus, physicalContainers);
    }

    // ============================================================
    // INVOICE / CIR REPORT MODE (Stored Procedure)
    // ============================================================
    private static void queryInvoice(Connection conn, String fromDate, String toDate,
            String companyIdStr, String terminalIdStr, String serviceTypeStr,
            String customerIdStr, boolean useStoredProc, int page, int limit, long startTime) throws Exception {
        if (!useStoredProc) {
            System.out.printf("{\"success\":false,\"error\":\"Invoice mode requires useStoredProc=true\"}\n");
            return;
        }

        // If no date range provided (All-Time view), default to a wide range covering all data
        if (fromDate == null || fromDate.isEmpty()) fromDate = "01/01/2000";
        if (toDate == null || toDate.isEmpty()) {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("dd/MM/yyyy");
            toDate = sdf.format(new java.util.Date());
        }

        String callSql = "{call REPORT_PKG.SP_INVOICE_REPORT_NEW(?, ?, ?, ?, ?, ?)}";

        int tId = 5;
        try { if (terminalIdStr != null && !terminalIdStr.equalsIgnoreCase("all")) tId = Integer.parseInt(terminalIdStr); } catch (Exception e) {}

        int cId = 2;
        try { if (companyIdStr != null && !companyIdStr.equalsIgnoreCase("all")) cId = Integer.parseInt(companyIdStr); } catch (Exception e) {}

        String fDateFormatted = formatDateToDDMMYYYY(fromDate);
        String tDateFormatted = formatDateToDDMMYYYY(toDate);

        try (CallableStatement cstmt = conn.prepareCall(callSql)) {
            cstmt.setInt(1, tId);
            cstmt.setInt(2, cId);
            cstmt.setString(3, fDateFormatted);
            cstmt.setString(4, tDateFormatted);
            cstmt.setString(5, (serviceTypeStr != null && !serviceTypeStr.isEmpty()) ? serviceTypeStr : "0");
            cstmt.registerOutParameter(6, OracleTypes.CURSOR);

            cstmt.execute();

            Set<String> uniqueInvoices = new HashSet<>();
            Map<String, Double> customerBaseMap = new HashMap<>();
            Map<String, Double> customerGrossMap = new HashMap<>();
            Map<String, Integer> customerInvCountMap = new HashMap<>();

            double grandBase = 0;
            double grandIgst = 0;
            double grandCgst = 0;
            double grandSgst = 0;
            double grandGross = 0;
            long totalRows = 0;

            StringBuilder recsJson = new StringBuilder("[");
            boolean firstR = true;

            try (ResultSet rs = (ResultSet) cstmt.getObject(6)) {
                while (rs.next()) {
                    totalRows++;
                    String invNo = rs.getString("INVOICE_NO");
                    String invRef = rs.getString("INVOICE_REF_NO");
                    String custName = rs.getString("CUSTOMER_NAME");
                    String invDate = rs.getString("INVOICE_DATE");
                    String sType = rs.getString("SERVICE_TYPE");
                    String blNo = rs.getString("BL_NO");
                    double base = rs.getDouble("AMOUNT");
                    double igst = rs.getDouble("IGST");
                    double cgst = rs.getDouble("CGST");
                    double sgst = rs.getDouble("SGST");
                    double gross = rs.getDouble("INVOICE_AMOUNT");

                    uniqueInvoices.add(invNo);
                    grandBase += base;
                    grandIgst += igst;
                    grandCgst += cgst;
                    grandSgst += sgst;
                    grandGross += gross;

                    customerBaseMap.put(custName, customerBaseMap.getOrDefault(custName, 0.0) + base);
                    customerGrossMap.put(custName, customerGrossMap.getOrDefault(custName, 0.0) + gross);
                    customerInvCountMap.put(custName, customerInvCountMap.getOrDefault(custName, 0) + 1);

                    if (totalRows <= limit) {
                        if (!firstR) recsJson.append(",");
                        firstR = false;
                        recsJson.append(String.format(Locale.US,
                            "{\"INVOICE_NO\":\"%s\",\"INVOICE_REF_NO\":\"%s\",\"CUSTOMER_NAME\":\"%s\",\"INVOICE_DATE\":\"%s\"," +
                            "\"SERVICE_TYPE\":\"%s\",\"BL_NO\":\"%s\",\"AMOUNT\":%.2f,\"IGST\":%.2f,\"CGST\":%.2f,\"SGST\":%.2f,\"INVOICE_AMOUNT\":%.2f}",
                            escapeJson(invNo), escapeJson(invRef), escapeJson(custName), escapeJson(invDate),
                            escapeJson(sType), escapeJson(blNo), base, igst, cgst, sgst, gross
                        ));
                    }
                }
            }
            recsJson.append("]");

            double grandTax = grandIgst + grandCgst + grandSgst;

            List<Map.Entry<String, Double>> topCust = new ArrayList<>(customerGrossMap.entrySet());
            topCust.sort((a, b) -> Double.compare(b.getValue(), a.getValue()));

            StringBuilder custJson = new StringBuilder("[");
            for (int i = 0; i < Math.min(10, topCust.size()); i++) {
                if (i > 0) custJson.append(",");
                String cName = topCust.get(i).getKey();
                double grossVal = topCust.get(i).getValue();
                double baseVal = customerBaseMap.getOrDefault(cName, 0.0);
                int invCnt = customerInvCountMap.getOrDefault(cName, 0);
                custJson.append(String.format(Locale.US,
                    "{\"customerName\":\"%s\",\"taxableAmount\":%.2f,\"grossAmount\":%.2f,\"invoiceCount\":%d}",
                    escapeJson(cName), baseVal, grossVal, invCnt
                ));
            }
            custJson.append("]");

            long totalTime = System.currentTimeMillis() - startTime;

            String finalJson = String.format(Locale.US,
                "{\n" +
                "  \"success\": true,\n" +
                "  \"source\": \"ORACLE_SPJLIVE_STORED_PROCEDURE\",\n" +
                "  \"procedureName\": \"REPORT_PKG.SP_INVOICE_REPORT_NEW\",\n" +
                "  \"executionMode\": \"DIRECT_STORED_PROCEDURE_CALL\",\n" +
                "  \"parameters\": {\"terminalId\": %d, \"companyId\": %d, \"fromDate\": \"%s\", \"toDate\": \"%s\", \"serviceType\": \"%s\"},\n" +
                "  \"totalTimeMs\": %d,\n" +
                "  \"matchedRowCount\": %d,\n" +
                "  \"kpis\": {\n" +
                "    \"totalGrossAmount\": %.2f,\n" +
                "    \"totalBillAmount\": %.2f,\n" +
                "    \"totalTax\": %.2f,\n" +
                "    \"totalIgst\": %.2f,\n" +
                "    \"totalCgst\": %.2f,\n" +
                "    \"totalSgst\": %.2f,\n" +
                "    \"invoiceCount\": %d,\n" +
                "    \"lineItemCount\": %d\n" +
                "  },\n" +
                "  \"topCustomers\": %s,\n" +
                "  \"records\": %s\n" +
                "}",
                tId, cId, fDateFormatted, tDateFormatted, serviceTypeStr, totalTime, totalRows,
                grandGross, grandBase, grandTax, grandIgst, grandCgst, grandSgst, uniqueInvoices.size(), totalRows,
                custJson.toString(), recsJson.toString()
            );

            System.out.println(finalJson);
        }
    }

    // ============================================================
    // CONTAINERS MODE (ALL_PARTY_ACCOUNT)
    // ============================================================
    private static void queryContainers(Connection conn, String terminalIdStr, String customerIdStr,
            String companyIdStr, String search, String contNo, String blNo, String tripType,
            String size, int page, int limit, long startTime) throws Exception {
        StringBuilder sql = new StringBuilder(
            "SELECT AP.CONT_NO, AP.CONT_SIZE, AP.CONT_TYPE, AP.TRIP_TYPE, AP.PORT, AP.LINE_HANDOVER_DATE, AP.SAILED, " +
            "AP.PARTY_INV_NO, AP.BL_NO, AP.SHIPPER_NAME, AP.CONSINGEE_NAME, " +
            "I.TERMINAL_ID, I.COMPANY_ID, I.BILL_TO, CM.CUSTOMER_NAME " +
            "FROM SPJLIVE.ALL_PARTY_ACCOUNT AP " +
            "LEFT JOIN SPJLIVE.IMP_INVOICE I ON AP.CONT_JO_ID = I.LINE_ITEM_ID " +
            "LEFT JOIN SPJLIVE.CUSTOMER_MASTER CM ON I.BILL_TO = CM.CUSTOMER_ID " +
            "WHERE AP.CONT_NO IS NOT NULL ");

        if (terminalIdStr != null && !terminalIdStr.isEmpty() && !terminalIdStr.equalsIgnoreCase("all")) {
            sql.append("AND I.TERMINAL_ID = ").append(terminalIdStr).append(" ");
        }
        if (companyIdStr != null && !companyIdStr.isEmpty() && !companyIdStr.equalsIgnoreCase("all")) {
            sql.append("AND I.COMPANY_ID = ").append(companyIdStr).append(" ");
        }
        if (customerIdStr != null && !customerIdStr.isEmpty() && !customerIdStr.equalsIgnoreCase("all")) {
            sql.append("AND (UPPER(CM.CUSTOMER_NAME) LIKE '%").append(customerIdStr.toUpperCase()).append("%' ")
               .append("OR CM.CUSTOMER_ID = ").append(customerIdStr).append(") ");
        }
        if (contNo != null && !contNo.isEmpty()) {
            sql.append("AND UPPER(AP.CONT_NO) LIKE '%").append(contNo.toUpperCase()).append("%' ");
        }
        if (blNo != null && !blNo.isEmpty()) {
            sql.append("AND UPPER(AP.BL_NO) LIKE '%").append(blNo.toUpperCase()).append("%' ");
        }
        if (tripType != null && !tripType.isEmpty() && !tripType.equalsIgnoreCase("all")) {
            sql.append("AND UPPER(AP.TRIP_TYPE) = '").append(tripType.toUpperCase()).append("' ");
        }
        if (size != null && !size.isEmpty() && !size.equalsIgnoreCase("all")) {
            sql.append("AND AP.CONT_SIZE = '").append(size).append("' ");
        }
        if (search != null && !search.isEmpty()) {
            sql.append("AND (UPPER(AP.CONT_NO) LIKE '%").append(search.toUpperCase()).append("%' ")
               .append("OR UPPER(AP.BL_NO) LIKE '%").append(search.toUpperCase()).append("%' ")
               .append("OR UPPER(AP.SHIPPER_NAME) LIKE '%").append(search.toUpperCase()).append("%' ")
               .append("OR UPPER(AP.CONSINGEE_NAME) LIKE '%").append(search.toUpperCase()).append("%') ");
        }

        sql.append("ORDER BY AP.LINE_HANDOVER_DATE DESC NULLS LAST ");

        // Count total
        long total = 0;
        String countSql = "SELECT COUNT(*) FROM (" + sql.toString().replace("ORDER BY AP.LINE_HANDOVER_DATE DESC NULLS LAST", "") + ")";
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(countSql)) {
            if (rs.next()) total = rs.getLong(1);
        }

        // Pagination
        int offset = (page - 1) * limit;
        String pagedSql = "SELECT * FROM (" + sql.toString() + ") WHERE ROWNUM <= " + (offset + limit) +
                          " AND ROWNUM > " + offset;

        StringBuilder recsJson = new StringBuilder("[");
        boolean first = true;
        long count = 0;
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(pagedSql)) {
            while (rs.next()) {
                count++;
                if (!first) recsJson.append(",");
                first = false;
                recsJson.append(String.format(Locale.US,
                    "{\"CONT_NO\":\"%s\",\"CONT_SIZE\":\"%s\",\"CONT_TYPE\":\"%s\",\"TRIP_TYPE\":\"%s\",\"PORT\":\"%s\"," +
                    "\"LINE_HANDOVER_DATE\":\"%s\",\"SAILED\":\"%s\",\"PARTY_INV_NO\":\"%s\",\"BL_NO\":\"%s\"," +
                    "\"SHIPPER_NAME\":\"%s\",\"CONSINGEE_NAME\":\"%s\",\"TERMINAL_ID\":%d,\"COMPANY_ID\":%d,\"CUSTOMER_NAME\":\"%s\"}",
                    escapeJson(rs.getString("CONT_NO")), escapeJson(rs.getString("CONT_SIZE")),
                    escapeJson(rs.getString("CONT_TYPE")), escapeJson(rs.getString("TRIP_TYPE")),
                    escapeJson(rs.getString("PORT")), fmtDate(rs.getDate("LINE_HANDOVER_DATE")),
                    fmtDate(rs.getDate("SAILED")), escapeJson(rs.getString("PARTY_INV_NO")),
                    escapeJson(rs.getString("BL_NO")), escapeJson(rs.getString("SHIPPER_NAME")),
                    escapeJson(rs.getString("CONSINGEE_NAME")), rs.getInt("TERMINAL_ID"),
                    rs.getInt("COMPANY_ID"), escapeJson(rs.getString("CUSTOMER_NAME"))
                ));
            }
        }
        recsJson.append("]");

        long totalTime = System.currentTimeMillis() - startTime;
        System.out.printf(Locale.US,
            "{\"success\":true,\"source\":\"ORACLE_SPJLIVE_LIVE\",\"mode\":\"containers\",\"total\":%d,\"count\":%d,\"page\":%d,\"limit\":%d,\"totalTimeMs\":%d,\"records\":%s}",
            total, count, page, limit, totalTime, recsJson.toString());
    }

    // ============================================================
    // FLEET MODE (FLEET_EQUIPMENT_MASTER)
    // ============================================================
    private static void queryFleet(Connection conn, String terminalIdStr, String search,
            int page, int limit, long startTime) throws Exception {
        StringBuilder sql = new StringBuilder(
            "SELECT EQUIPMENT_ID, EQUIPMENT_NO, EQUIPMENT_TYPE, MODEL, MANUFACTURING_YEAR, CONDITION, " +
            "STATUS, TARE_WT, GROSS_WT, TERMINAL_ID, REGISTRATION_DATE, INS_VALIDITY, PERMIT_TO " +
            "FROM SPJLIVE.FLEET_EQUIPMENT_MASTER WHERE 1=1 ");

        if (terminalIdStr != null && !terminalIdStr.isEmpty() && !terminalIdStr.equalsIgnoreCase("all")) {
            sql.append("AND TERMINAL_ID = ").append(terminalIdStr).append(" ");
        }
        if (search != null && !search.isEmpty()) {
            sql.append("AND UPPER(EQUIPMENT_NO) LIKE '%").append(search.toUpperCase()).append("%' ");
        }

        long total = 0;
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(
            "SELECT COUNT(*) FROM (" + sql.toString() + ")")) {
            if (rs.next()) total = rs.getLong(1);
        }

        int offset = (page - 1) * limit;
        String pagedSql = "SELECT * FROM (" + sql.toString() + " ORDER BY EQUIPMENT_ID) WHERE ROWNUM <= " + (offset + limit) +
                          " AND ROWNUM > " + offset;

        StringBuilder recsJson = new StringBuilder("[");
        boolean first = true;
        long count = 0;
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(pagedSql)) {
            while (rs.next()) {
                count++;
                if (!first) recsJson.append(",");
                first = false;
                recsJson.append(String.format(Locale.US,
                    "{\"id\":%d,\"equipmentNo\":\"%s\",\"equipmentType\":\"%s\",\"model\":\"%s\",\"manufacturingYear\":%d," +
                    "\"condition\":\"%s\",\"status\":\"%s\",\"tareWeight\":%.2f,\"grossWeight\":%.2f,\"terminalId\":%d," +
                    "\"registrationDate\":\"%s\",\"insuranceValidity\":\"%s\",\"permitTo\":\"%s\"}",
                    rs.getInt("EQUIPMENT_ID"), escapeJson(rs.getString("EQUIPMENT_NO")),
                    escapeJson(rs.getString("EQUIPMENT_TYPE")), escapeJson(rs.getString("MODEL")),
                    rs.getInt("MANUFACTURING_YEAR"), escapeJson(rs.getString("CONDITION")),
                    escapeJson(rs.getString("STATUS")), rs.getDouble("TARE_WT"), rs.getDouble("GROSS_WT"),
                    rs.getInt("TERMINAL_ID"), fmtDate(rs.getDate("REGISTRATION_DATE")),
                    fmtDate(rs.getDate("INS_VALIDITY")), fmtDate(rs.getDate("PERMIT_TO"))
                ));
            }
        }
        recsJson.append("]");

        long totalTime = System.currentTimeMillis() - startTime;
        System.out.printf(Locale.US,
            "{\"success\":true,\"source\":\"ORACLE_SPJLIVE_LIVE\",\"mode\":\"fleet\",\"total\":%d,\"count\":%d,\"page\":%d,\"limit\":%d,\"totalTimeMs\":%d,\"records\":%s}",
            total, count, page, limit, totalTime, recsJson.toString());
    }

    // ============================================================
    // MASTERS MODE (TERMINAL / CUSTOMER / SERVICE)
    // ============================================================
    private static void queryMasters(Connection conn, String terminalIdStr, long startTime) throws Exception {
        // Terminals
        StringBuilder termJson = new StringBuilder("[");
        boolean firstT = true;
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(
            "SELECT TERMINAL_ID, TERMINAL_CODE, TERMINAL_NAME, ADDRESS, STATE_CODE FROM SPJLIVE.TERMINAL_MASTER ORDER BY TERMINAL_NAME")) {
            while (rs.next()) {
                if (!firstT) termJson.append(",");
                firstT = false;
                termJson.append(String.format(Locale.US,
                    "{\"terminalId\":%d,\"terminalCode\":\"%s\",\"terminalName\":\"%s\",\"address\":\"%s\",\"stateCode\":\"%s\"}",
                    rs.getInt("TERMINAL_ID"), escapeJson(rs.getString("TERMINAL_CODE")),
                    escapeJson(rs.getString("TERMINAL_NAME")), escapeJson(rs.getString("ADDRESS")),
                    escapeJson(rs.getString("STATE_CODE"))
                ));
            }
        }
        termJson.append("]");

        // Customers
        StringBuilder custJson = new StringBuilder("[");
        boolean firstC = true;
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(
            "SELECT CUSTOMER_ID, CUSTOMER_CODE, CUSTOMER_NAME, CITY, STATE_CODE, STATUS FROM SPJLIVE.CUSTOMER_MASTER ORDER BY CUSTOMER_NAME")) {
            while (rs.next()) {
                if (!firstC) custJson.append(",");
                firstC = false;
                custJson.append(String.format(Locale.US,
                    "{\"customerId\":%d,\"customerCode\":\"%s\",\"customerName\":\"%s\",\"city\":\"%s\",\"stateCode\":\"%s\",\"status\":\"%s\"}",
                    rs.getInt("CUSTOMER_ID"), escapeJson(rs.getString("CUSTOMER_CODE")),
                    escapeJson(rs.getString("CUSTOMER_NAME")), escapeJson(rs.getString("CITY")),
                    escapeJson(rs.getString("STATE_CODE")), escapeJson(rs.getString("STATUS"))
                ));
            }
        }
        custJson.append("]");

        // Services
        StringBuilder servJson = new StringBuilder("[");
        boolean firstS = true;
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(
            "SELECT SERVICE_ID, SERVICE_CODE, SERVICE_NAME, SERVICE_TYPE_CODE FROM SPJLIVE.SERVICE_MASTER ORDER BY SERVICE_NAME")) {
            while (rs.next()) {
                if (!firstS) servJson.append(",");
                firstS = false;
                servJson.append(String.format(Locale.US,
                    "{\"serviceId\":%d,\"serviceCode\":\"%s\",\"serviceName\":\"%s\",\"serviceTypeCode\":\"%s\"}",
                    rs.getInt("SERVICE_ID"), escapeJson(rs.getString("SERVICE_CODE")),
                    escapeJson(rs.getString("SERVICE_NAME")), escapeJson(rs.getString("SERVICE_TYPE_CODE"))
                ));
            }
        }
        servJson.append("]");

        long totalTime = System.currentTimeMillis() - startTime;
        System.out.printf(Locale.US,
            "{\"success\":true,\"source\":\"ORACLE_SPJLIVE_LIVE\",\"mode\":\"masters\",\"totalTimeMs\":%d,\"terminals\":%s,\"customers\":%s,\"services\":%s}",
            totalTime, termJson.toString(), custJson.toString(), servJson.toString());
    }
}