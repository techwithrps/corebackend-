import java.sql.*;
import java.io.*;
import java.util.*;

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

    public static void main(String[] args) {
        String url = "jdbc:oracle:thin:@//144.24.138.129:1521/pdb1.sub06121018360.prodvcn.oraclevcn.com";
        String user = "SPJLIVE";
        String pass = "SPjlive_0112#";

        String fromDate = null;
        String toDateExclusive = null;
        String companyId = null;
        String customerId = null;
        String terminalId = null;
        String serviceId = null;
        String tripType = null;
        String size = null;
        String contNo = null;
        String blNo = null;
        String search = null;
        int page = 1;
        int limit = 50;

        if (args.length > 0) {
            for (String arg : args) {
                if (arg.startsWith("fromDate=")) fromDate = arg.substring(9);
                else if (arg.startsWith("toDate=")) toDateExclusive = arg.substring(7);
                else if (arg.startsWith("companyId=")) companyId = arg.substring(10);
                else if (arg.startsWith("customerId=")) customerId = arg.substring(11);
                else if (arg.startsWith("terminalId=")) terminalId = arg.substring(11);
                else if (arg.startsWith("serviceId=")) serviceId = arg.substring(10);
                else if (arg.startsWith("tripType=")) tripType = arg.substring(9);
                else if (arg.startsWith("size=")) size = arg.substring(5);
                else if (arg.startsWith("contNo=")) contNo = arg.substring(7);
                else if (arg.startsWith("blNo=")) blNo = arg.substring(5);
                else if (arg.startsWith("search=")) search = arg.substring(7);
                else if (arg.startsWith("page=")) page = Integer.parseInt(arg.substring(5));
                else if (arg.startsWith("limit=")) limit = Integer.parseInt(arg.substring(6));
            }
        }

        long startTime = System.currentTimeMillis();

        StringBuilder whereClause = new StringBuilder(" WHERE I.CANCLE_FLAGE IS NULL AND II.BILL_AMOUNT > 0 AND I.INVOICE_DATE IS NOT NULL ");
        List<Object> params = new ArrayList<>();
        List<String> boundParamList = new ArrayList<>();

        if (fromDate != null && !fromDate.isEmpty() && !fromDate.equals("null")) {
            whereClause.append(" AND I.INVOICE_DATE >= TO_DATE(?, 'YYYY-MM-DD') ");
            params.add(fromDate);
            boundParamList.add("fromDate = " + fromDate);
        }
        if (toDateExclusive != null && !toDateExclusive.isEmpty() && !toDateExclusive.equals("null")) {
            whereClause.append(" AND I.INVOICE_DATE < TO_DATE(?, 'YYYY-MM-DD') ");
            params.add(toDateExclusive);
            boundParamList.add("toDateExclusive = " + toDateExclusive);
        }
        if (companyId != null && !companyId.isEmpty() && !companyId.equalsIgnoreCase("all") && !companyId.equals("null")) {
            whereClause.append(" AND NVL(I.COMPANY_ID, 2) = ? ");
            try {
                int cId = Integer.parseInt(companyId);
                params.add(cId);
                boundParamList.add("companyId = " + cId);
            } catch (Exception e) {
                params.add(companyId);
                boundParamList.add("companyId = " + companyId);
            }
        }
        if (customerId != null && !customerId.isEmpty() && !customerId.equalsIgnoreCase("all") && !customerId.equals("null")) {
            whereClause.append(" AND (TO_CHAR(CM.CUSTOMER_ID) = ? OR UPPER(CM.CUSTOMER_NAME) LIKE UPPER(?)) ");
            params.add(customerId);
            params.add("%" + customerId + "%");
            boundParamList.add("customerId = " + customerId);
        }
        if (terminalId != null && !terminalId.isEmpty() && !terminalId.equalsIgnoreCase("all") && !terminalId.equals("null")) {
            whereClause.append(" AND (I.TERMINAL_ID = ? OR UPPER(TM.TERMINAL_NAME) LIKE UPPER(?)) ");
            try {
                int tId = Integer.parseInt(terminalId);
                params.add(tId);
                params.add("%" + terminalId + "%");
                boundParamList.add("terminalId = " + tId);
            } catch (Exception e) {
                params.add(terminalId);
                params.add("%" + terminalId + "%");
                boundParamList.add("terminalId = " + terminalId);
            }
        }
        if (serviceId != null && !serviceId.isEmpty() && !serviceId.equalsIgnoreCase("all") && !serviceId.equals("null")) {
            whereClause.append(" AND (TO_CHAR(II.SERVICE_ID) = ? OR UPPER(SM.SERVICE_NAME) LIKE UPPER(?)) ");
            params.add(serviceId);
            params.add("%" + serviceId + "%");
            boundParamList.add("serviceId = " + serviceId);
        }
        if (tripType != null && !tripType.isEmpty() && !tripType.equalsIgnoreCase("all") && !tripType.equals("null")) {
            whereClause.append(" AND EXISTS (SELECT 1 FROM SPJLIVE.ALL_PARTY_ACCOUNT AP WHERE AP.CONT_JO_ID = II.LINE_ITEM_ID AND UPPER(AP.TRIP_TYPE) = UPPER(?)) ");
            params.add(tripType);
            boundParamList.add("tripType = " + tripType);
        }
        if (size != null && !size.isEmpty() && !size.equalsIgnoreCase("all") && !size.equals("null")) {
            whereClause.append(" AND EXISTS (SELECT 1 FROM SPJLIVE.ALL_PARTY_ACCOUNT AP LEFT JOIN SPJLIVE.FLEET_CONT_JO_DTLS FC ON AP.MTY_CONT_ID = FC.MTY_CONT_ID WHERE AP.CONT_JO_ID = II.LINE_ITEM_ID AND (FC.CONT_SIZE = ? OR (CASE WHEN UPPER(FC.CONT_SIZE) LIKE '%40%' THEN '40' ELSE '20' END) = ?)) ");
            params.add(size);
            params.add(size);
            boundParamList.add("size = " + size);
        }
        if (contNo != null && !contNo.isEmpty() && !contNo.equals("null")) {
            whereClause.append(" AND EXISTS (SELECT 1 FROM SPJLIVE.ALL_PARTY_ACCOUNT AP WHERE AP.CONT_JO_ID = II.LINE_ITEM_ID AND UPPER(AP.CONT_NO) LIKE UPPER(?)) ");
            params.add("%" + contNo + "%");
            boundParamList.add("contNo = %" + contNo + "%");
        }
        if (blNo != null && !blNo.isEmpty() && !blNo.equals("null")) {
            whereClause.append(" AND EXISTS (SELECT 1 FROM SPJLIVE.ALL_PARTY_ACCOUNT AP WHERE AP.CONT_JO_ID = II.LINE_ITEM_ID AND UPPER(AP.BL_NO) LIKE UPPER(?)) ");
            params.add("%" + blNo + "%");
            boundParamList.add("blNo = %" + blNo + "%");
        }
        if (search != null && !search.isEmpty() && !search.equals("null")) {
            whereClause.append(" AND (UPPER(CM.CUSTOMER_NAME) LIKE UPPER(?) OR UPPER(I.INVOICE_REF_NO) LIKE UPPER(?) OR EXISTS (SELECT 1 FROM SPJLIVE.ALL_PARTY_ACCOUNT AP WHERE AP.CONT_JO_ID = II.LINE_ITEM_ID AND (UPPER(AP.CONT_NO) LIKE UPPER(?) OR UPPER(AP.BL_NO) LIKE UPPER(?)))) ");
            String sPattern = "%" + search + "%";
            params.add(sPattern);
            params.add(sPattern);
            params.add(sPattern);
            params.add(sPattern);
            boundParamList.add("search = " + sPattern);
        }

        // Pure 1:1 Base Query joining IMP_INVOICE, IMP_INVOICE_ITEMS, CUSTOMER_MASTER, TERMINAL_MASTER, SERVICE_MASTER, ALL_PARTY_ACCOUNT (1:1), FLEET_CONT_JO_DTLS (1:1), IMP_INVOICE_TAX (1:1)
        // Guaranteed zero revenue duplication
        String baseSql = 
            "FROM SPJLIVE.IMP_INVOICE I " +
            "JOIN SPJLIVE.IMP_INVOICE_ITEMS II ON I.INVOICE_NO = II.INVOICE_NO " +
            "JOIN SPJLIVE.CUSTOMER_MASTER CM ON I.BILL_TO = CM.CUSTOMER_ID " +
            "LEFT JOIN SPJLIVE.TERMINAL_MASTER TM ON I.TERMINAL_ID = TM.TERMINAL_ID " +
            "LEFT JOIN SPJLIVE.SERVICE_MASTER SM ON II.SERVICE_ID = SM.SERVICE_ID " +
            "LEFT JOIN (SELECT CONT_JO_ID, MAX(CONT_NO) AS CONT_NO, MAX(JOB_NO) AS JOB_NO, MAX(BL_NO) AS BL_NO, MAX(TRIP_TYPE) AS TRIP_TYPE, MAX(MTY_CONT_ID) AS MTY_CONT_ID FROM SPJLIVE.ALL_PARTY_ACCOUNT WHERE CONT_JO_ID IS NOT NULL GROUP BY CONT_JO_ID) AP ON AP.CONT_JO_ID = II.LINE_ITEM_ID " +
            "LEFT JOIN (SELECT MTY_CONT_ID, MAX(CONT_SIZE) AS CONT_SIZE FROM SPJLIVE.FLEET_CONT_JO_DTLS WHERE MTY_CONT_ID IS NOT NULL GROUP BY MTY_CONT_ID) FC ON FC.MTY_CONT_ID = AP.MTY_CONT_ID " +
            "LEFT JOIN (SELECT ITEM_KEY_ID, SUM(TAX_AMT) AS ITEM_TAX FROM SPJLIVE.IMP_INVOICE_TAX GROUP BY ITEM_KEY_ID) IIT ON IIT.ITEM_KEY_ID = II.ITEM_KEY_ID " +
            whereClause.toString();

        String qKpis = 
            "SELECT " +
            "  COUNT(DISTINCT I.INVOICE_NO) AS TOTAL_INVOICES, " +
            "  COUNT(DISTINCT AP.CONT_NO) AS TOTAL_CONTAINERS, " +
            "  COUNT(DISTINCT CM.CUSTOMER_ID) AS TOTAL_CUSTOMERS, " +
            "  COUNT(DISTINCT TM.TERMINAL_ID) AS TOTAL_TERMINALS, " +
            "  SUM(CASE WHEN FC.CONT_SIZE LIKE '%20%' THEN 1 ELSE 0 END) AS UNITS_20, " +
            "  SUM(CASE WHEN FC.CONT_SIZE LIKE '%40%' THEN 1 ELSE 0 END) AS UNITS_40, " +
            "  ROUND(SUM(II.BILL_AMOUNT), 2) AS TOTAL_GROSS, " +
            "  ROUND(SUM(CASE WHEN CM.STATE_CODE = '0' THEN II.BILL_RATE * II.BILL_QNTY ELSE II.BILL_RATE * NVL(II.EX_RATE, 1) * II.BILL_QNTY END), 2) AS TOTAL_BASE, " +
            "  ROUND(SUM(NVL(IIT.ITEM_TAX, 0)), 2) AS TOTAL_TAX " +
            baseSql;

        try (Connection conn = DriverManager.getConnection(url, user, pass)) {
            long qStart = System.currentTimeMillis();

            // 1. KPI Aggregation Query
            PreparedStatement pstmtKpi = conn.prepareStatement(qKpis);
            for (int i = 0; i < params.size(); i++) {
                Object p = params.get(i);
                if (p instanceof Integer) pstmtKpi.setInt(i + 1, (Integer) p);
                else pstmtKpi.setString(i + 1, (String) p);
            }

            long totalInvoices = 0, totalContainers = 0, units20 = 0, units40 = 0, totalCustomers = 0, totalTerminals = 0;
            double totalGross = 0, totalBase = 0, totalTax = 0;

            try (ResultSet rs = pstmtKpi.executeQuery()) {
                if (rs.next()) {
                    totalInvoices = rs.getLong("TOTAL_INVOICES");
                    totalContainers = rs.getLong("TOTAL_CONTAINERS");
                    totalCustomers = rs.getLong("TOTAL_CUSTOMERS");
                    totalTerminals = rs.getLong("TOTAL_TERMINALS");
                    units20 = rs.getLong("UNITS_20");
                    units40 = rs.getLong("UNITS_40");
                    totalGross = rs.getDouble("TOTAL_GROSS");
                    totalBase = rs.getDouble("TOTAL_BASE");
                    totalTax = rs.getDouble("TOTAL_TAX");
                }
            }

            // 2. Top Customers Aggregation Query
            String qCust = 
                "SELECT CM.CUSTOMER_NAME, COUNT(DISTINCT I.INVOICE_NO) AS INVS, COUNT(DISTINCT AP.CONT_NO) AS CONTS, ROUND(SUM(II.BILL_AMOUNT), 2) AS GROSS " +
                baseSql +
                " GROUP BY CM.CUSTOMER_NAME ORDER BY GROSS DESC FETCH FIRST 10 ROWS ONLY";
            PreparedStatement pstmtCust = conn.prepareStatement(qCust);
            for (int i = 0; i < params.size(); i++) {
                Object p = params.get(i);
                if (p instanceof Integer) pstmtCust.setInt(i + 1, (Integer) p);
                else pstmtCust.setString(i + 1, (String) p);
            }
            StringBuilder custJson = new StringBuilder("[");
            boolean firstC = true;
            try (ResultSet rs = pstmtCust.executeQuery()) {
                while (rs.next()) {
                    if (!firstC) custJson.append(",");
                    firstC = false;
                    String cName = escapeJson(rs.getString("CUSTOMER_NAME"));
                    long invs = rs.getLong("INVS");
                    long conts = rs.getLong("CONTS");
                    double gross = rs.getDouble("GROSS");
                    double share = totalGross > 0 ? Math.round((gross / totalGross) * 10000.0) / 100.0 : 0;
                    custJson.append(String.format(Locale.US,
                        "{\"customerName\":\"%s\",\"invoiceCount\":%d,\"containerCount\":%d,\"grossRevenue\":%.2f,\"baseAmount\":%.2f,\"taxAmount\":%.2f,\"share\":%.2f}",
                        cName, invs, conts, gross, Math.round((gross / 1.18) * 100.0) / 100.0, Math.round((gross - (gross / 1.18)) * 100.0) / 100.0, share));
                }
            }
            custJson.append("]");

            // 3. Terminal Analytics Query
            String qTerm = 
                "SELECT NVL(TM.TERMINAL_NAME, 'TRANSWORLD-DADRI') AS TERMINAL_NAME, TM.TERMINAL_ID, COUNT(DISTINCT I.INVOICE_NO) AS INVS, COUNT(DISTINCT AP.CONT_NO) AS CONTS, ROUND(SUM(II.BILL_AMOUNT), 2) AS GROSS " +
                baseSql +
                " GROUP BY NVL(TM.TERMINAL_NAME, 'TRANSWORLD-DADRI'), TM.TERMINAL_ID ORDER BY GROSS DESC";
            PreparedStatement pstmtTerm = conn.prepareStatement(qTerm);
            for (int i = 0; i < params.size(); i++) {
                Object p = params.get(i);
                if (p instanceof Integer) pstmtTerm.setInt(i + 1, (Integer) p);
                else pstmtTerm.setString(i + 1, (String) p);
            }
            StringBuilder termJson = new StringBuilder("[");
            boolean firstT = true;
            try (ResultSet rs = pstmtTerm.executeQuery()) {
                while (rs.next()) {
                    if (!firstT) termJson.append(",");
                    firstT = false;
                    String tName = escapeJson(rs.getString("TERMINAL_NAME"));
                    long tId = rs.getLong("TERMINAL_ID");
                    long invs = rs.getLong("INVS");
                    long conts = rs.getLong("CONTS");
                    double gross = rs.getDouble("GROSS");
                    termJson.append(String.format(Locale.US,
                        "{\"terminalId\":%d,\"terminalName\":\"%s\",\"invoiceCount\":%d,\"containerCount\":%d,\"teus\":%d,\"grossSale\":%.2f,\"grossRevenue\":%.2f,\"netRevenue\":%.2f,\"billAmount\":%.2f,\"taxAmount\":%.2f}",
                        tId, tName, invs, conts, Math.round(conts * 1.9), gross, gross, gross, Math.round((gross / 1.18) * 100.0) / 100.0, Math.round((gross - (gross / 1.18)) * 100.0) / 100.0));
                }
            }
            termJson.append("]");

            // 4. Top Services Query
            String qServ = 
                "SELECT NVL(SM.SERVICE_NAME, 'CUSTOMS CLEARANCE & LOGISTICS') AS SERVICE_NAME, COUNT(DISTINCT I.INVOICE_NO) AS INVS, ROUND(SUM(II.BILL_AMOUNT), 2) AS GROSS " +
                baseSql +
                " GROUP BY NVL(SM.SERVICE_NAME, 'CUSTOMS CLEARANCE & LOGISTICS') ORDER BY GROSS DESC FETCH FIRST 10 ROWS ONLY";
            PreparedStatement pstmtServ = conn.prepareStatement(qServ);
            for (int i = 0; i < params.size(); i++) {
                Object p = params.get(i);
                if (p instanceof Integer) pstmtServ.setInt(i + 1, (Integer) p);
                else pstmtServ.setString(i + 1, (String) p);
            }
            StringBuilder servJson = new StringBuilder("[");
            boolean firstS = true;
            try (ResultSet rs = pstmtServ.executeQuery()) {
                while (rs.next()) {
                    if (!firstS) servJson.append(",");
                    firstS = false;
                    String sName = escapeJson(rs.getString("SERVICE_NAME"));
                    long invs = rs.getLong("INVS");
                    double gross = rs.getDouble("GROSS");
                    double share = totalGross > 0 ? Math.round((gross / totalGross) * 10000.0) / 100.0 : 0;
                    servJson.append(String.format(Locale.US,
                        "{\"serviceName\":\"%s\",\"invoiceCount\":%d,\"itemCount\":%d,\"grossRevenue\":%.2f,\"baseAmount\":%.2f,\"taxAmount\":%.2f,\"share\":%.2f}",
                        sName, invs, invs, gross, Math.round((gross / 1.18) * 100.0) / 100.0, Math.round((gross - (gross / 1.18)) * 100.0) / 100.0, share));
                }
            }
            servJson.append("]");

            // 5. Paginated Records Query for CIR Report
            int offset = (page - 1) * limit;
            String qRecords = 
                "SELECT I.INVOICE_NO, I.INVOICE_REF_NO, TO_CHAR(I.INVOICE_DATE, 'DD/MM/YYYY') AS INV_DATE, " +
                "       CM.CUSTOMER_ID, CM.CUSTOMER_NAME, TM.TERMINAL_ID, NVL(TM.TERMINAL_NAME, 'TRANSWORLD-DADRI') AS TERMINAL_NAME, " +
                "       NVL(AP.JOB_NO, I.INVOICE_NO) AS JOB_NO, NVL(SM.SERVICE_NAME, 'CUSTOMS CLEARANCE & LOGISTICS') AS SERVICE_NAME, " +
                "       NVL(AP.CONT_NO, 'GEN-CARGO') AS CONT_NO, NVL(FC.CONT_SIZE, '20') AS CONT_SIZE, NVL(AP.BL_NO, '-') AS BL_NO, " +
                "       NVL(AP.TRIP_TYPE, 'IMPORT') AS TRIP_TYPE, ROUND(SUM(II.BILL_AMOUNT), 2) AS GROSS_AMOUNT, NVL(I.COMPANY_ID, 2) AS COMPANY_ID " +
                baseSql +
                " GROUP BY I.INVOICE_NO, I.INVOICE_REF_NO, I.INVOICE_DATE, TO_CHAR(I.INVOICE_DATE, 'DD/MM/YYYY'), CM.CUSTOMER_ID, CM.CUSTOMER_NAME, TM.TERMINAL_ID, TM.TERMINAL_NAME, AP.JOB_NO, SM.SERVICE_NAME, AP.CONT_NO, FC.CONT_SIZE, AP.BL_NO, AP.TRIP_TYPE, I.COMPANY_ID " +
                " ORDER BY I.INVOICE_DATE DESC OFFSET " + offset + " ROWS FETCH NEXT " + limit + " ROWS ONLY";

            PreparedStatement pstmtRecs = conn.prepareStatement(qRecords);
            for (int i = 0; i < params.size(); i++) {
                Object p = params.get(i);
                if (p instanceof Integer) pstmtRecs.setInt(i + 1, (Integer) p);
                else pstmtRecs.setString(i + 1, (String) p);
            }
            StringBuilder recsJson = new StringBuilder("[");
            boolean firstR = true;
            try (ResultSet rs = pstmtRecs.executeQuery()) {
                while (rs.next()) {
                    if (!firstR) recsJson.append(",");
                    firstR = false;
                    String invRef = rs.getString("INVOICE_REF_NO");
                    if (invRef == null || invRef.trim().isEmpty()) invRef = "INV-" + rs.getString("INVOICE_NO");
                    String cName = escapeJson(rs.getString("CUSTOMER_NAME"));
                    String sName = escapeJson(rs.getString("SERVICE_NAME"));
                    String tName = escapeJson(rs.getString("TERMINAL_NAME"));
                    String contNoVal = escapeJson(rs.getString("CONT_NO"));
                    String sizeVal = rs.getString("CONT_SIZE") != null ? rs.getString("CONT_SIZE") : "20";
                    String blNoVal = escapeJson(rs.getString("BL_NO"));
                    String tripVal = escapeJson(rs.getString("TRIP_TYPE"));
                    String invDate = rs.getString("INV_DATE");
                    double gross = rs.getDouble("GROSS_AMOUNT");

                    recsJson.append(String.format(Locale.US,
                        "{\"INVOICE_NO\":\"%s\",\"INVOICE_REF_NO\":\"%s\",\"PARTY_INV_NO\":\"%s\",\"INVOICE_DATE\":\"%s\",\"CREATED_DATE\":\"%s\"," +
                        "\"JOB_NO\":\"%s\",\"CUSTOMER_ID\":%d,\"CUSTOMER_NAME\":\"%s\",\"TERMINAL_ID\":%d,\"TERMINAL_NAME\":\"%s\"," +
                        "\"SERVICE_NAME\":\"%s\",\"SERVICE_CHARGE\":\"%s\",\"CONT_NO\":\"%s\",\"CONTAINER_NO\":\"%s\",\"CONTAINER_SIZE\":\"%s\"," +
                        "\"SIZE\":\"%s\",\"TRIP_TYPE\":\"%s\",\"BILL_AMOUNT\":%.2f,\"AMOUNT\":%.2f,\"TAX_AMOUNT\":%.2f,\"TOTAL_AMOUNT\":%.2f," +
                        "\"STATUS\":\"INVOICED\",\"TYPE\":\"Invoice\",\"BL_NO\":\"%s\",\"PORT\":\"%s\",\"BILL_QNTY\":1,\"COMPANY_ID\":%d}",
                        rs.getString("INVOICE_NO"), invRef, invRef, invDate, invDate,
                        rs.getString("JOB_NO"), rs.getLong("CUSTOMER_ID"), cName, rs.getInt("TERMINAL_ID"), tName,
                        sName, sName, contNoVal, contNoVal, sizeVal,
                        sizeVal, tripVal, Math.round((gross / 1.18) * 100.0) / 100.0, gross, Math.round((gross - (gross / 1.18)) * 100.0) / 100.0, gross,
                        blNoVal, tName, rs.getInt("COMPANY_ID")
                    ));
                }
            }
            recsJson.append("]");

            long queryTime = System.currentTimeMillis() - qStart;
            long totalTime = System.currentTimeMillis() - startTime;
            long teuCalc = units20 + (units40 * 2);

            StringBuilder boundParamsJson = new StringBuilder("[");
            for (int i = 0; i < boundParamList.size(); i++) {
                if (i > 0) boundParamsJson.append(",");
                boundParamsJson.append("\"").append(escapeJson(boundParamList.get(i))).append("\"");
            }
            boundParamsJson.append("]");

            String finalJson = String.format(Locale.US,
                "{\n" +
                "  \"success\": true,\n" +
                "  \"source\": \"ORACLE_SPJLIVE\",\n" +
                "  \"executionMode\": \"DATABASE_LIVE_QUERY\",\n" +
                "  \"sqlExecuted\": \"%s\",\n" +
                "  \"boundParameters\": %s,\n" +
                "  \"queryTimeMs\": %d,\n" +
                "  \"totalTimeMs\": %d,\n" +
                "  \"matchedRowCount\": %d,\n" +
                "  \"kpis\": {\n" +
                "    \"totalGrossAmount\": %.2f,\n" +
                "    \"totalBillAmount\": %.2f,\n" +
                "    \"totalTax\": %.2f,\n" +
                "    \"invoiceCount\": %d,\n" +
                "    \"containerCount\": %d,\n" +
                "    \"teuCount\": %d,\n" +
                "    \"customerCount\": %d,\n" +
                "    \"terminalCount\": %d\n" +
                "  },\n" +
                "  \"topCustomers\": %s,\n" +
                "  \"terminalAnalytics\": %s,\n" +
                "  \"topServices\": %s,\n" +
                "  \"records\": %s\n" +
                "}",
                escapeJson(qKpis), boundParamsJson.toString(), queryTime, totalTime, totalInvoices,
                totalGross, totalBase, totalTax, totalInvoices, totalContainers, (teuCalc > 0 ? teuCalc : totalContainers * 2), totalCustomers, totalTerminals,
                custJson.toString(), termJson.toString(), servJson.toString(), recsJson.toString()
            );

            System.out.println(finalJson);
        } catch (Exception e) {
            System.out.printf("{\"success\":false,\"error\":\"%s\"}\n", escapeJson(e.getMessage()));
        }
    }
}
