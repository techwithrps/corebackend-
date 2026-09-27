import java.sql.*;
import java.io.*;
import java.util.*;
import oracle.jdbc.OracleTypes;

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
        // YYYY-MM-DD
        if (s.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
            String[] p = s.split("-");
            return p[2] + "/" + p[1] + "/" + p[0];
        }
        // DD/MM/YYYY
        if (s.matches("^\\d{2}/\\d{2}/\\d{4}$")) {
            return s;
        }
        return s;
    }

    public static void main(String[] args) {
        String url = "jdbc:oracle:thin:@//144.24.138.129:1521/pdb1.sub06121018360.prodvcn.oraclevcn.com";
        String user = "SPJLIVE";
        String pass = "SPjlive_0112#";

        String fromDate = null;
        String toDate = null;
        String companyIdStr = "2";
        String terminalIdStr = "5";
        String serviceTypeStr = "0";
        String customerIdStr = null;
        boolean useStoredProc = true;
        int page = 1;
        int limit = 50;

        if (args.length > 0) {
            for (String arg : args) {
                if (arg.startsWith("fromDate=")) fromDate = arg.substring(9);
                else if (arg.startsWith("toDate=")) toDate = arg.substring(7);
                else if (arg.startsWith("companyId=")) companyIdStr = arg.substring(10);
                else if (arg.startsWith("terminalId=")) terminalIdStr = arg.substring(11);
                else if (arg.startsWith("serviceType=")) serviceTypeStr = arg.substring(12);
                else if (arg.startsWith("customerId=")) customerIdStr = arg.substring(11);
                else if (arg.startsWith("useStoredProc=")) useStoredProc = Boolean.parseBoolean(arg.substring(14));
                else if (arg.startsWith("page=")) page = Integer.parseInt(arg.substring(5));
                else if (arg.startsWith("limit=")) limit = Integer.parseInt(arg.substring(6));
            }
        }

        long startTime = System.currentTimeMillis();

        if (useStoredProc && fromDate != null && toDate != null && !fromDate.isEmpty() && !toDate.isEmpty()) {
            // Direct Stored Procedure Mode (SP_INVOICE_REPORT_NEW)
            try (Connection conn = DriverManager.getConnection(url, user, pass)) {
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

                            if (totalRows <= 100) {
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

                    // Top Customers List
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
                    return;
                }
            } catch (Exception e) {
                System.out.printf("{\"success\":false,\"error\":\"%s\"}\n", escapeJson(e.getMessage()));
                return;
            }
        }
    }
}
