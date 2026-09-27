import java.sql.*;
import java.io.*;
import java.util.*;

public class OracleWarehouseExporter {
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

        System.out.println("Starting Oracle SPJLIVE Data Warehouse Extraction...");
        long startTime = System.currentTimeMillis();

        try (Connection conn = DriverManager.getConnection(url, user, pass);
             Statement st = conn.createStatement()) {

            // 1. All-Time Overall Grand Totals
            System.out.println("1. Extracting All-Time Financial Totals...");
            String qGrand = 
                "SELECT \n" +
                "  COUNT(DISTINCT INVOICE_NO) AS TOTAL_INVOICES, \n" +
                "  ROUND(SUM(AMOUNT), 2) AS TOTAL_BASE_AMOUNT, \n" +
                "  ROUND(SUM(IGST), 2) AS TOTAL_IGST, \n" +
                "  ROUND(SUM(SGST), 2) AS TOTAL_SGST, \n" +
                "  ROUND(SUM(CGST), 2) AS TOTAL_CGST, \n" +
                "  ROUND(SUM(INVOICE_AMOUNT), 2) AS TOTAL_GROSS_INVOICE_AMOUNT \n" +
                "FROM ( \n" +
                "  SELECT DISTINCT II.SERVICE_ID, II.IMP_CONT_ID, CM.CUSTOMER_NAME, I.INVOICE_REF_NO, I.INVOICE_NO, BL_NO, PARTY_INV_NO, LINE_HANDOVER_DATE, SAILED, PORT, \n" +
                "    DECODE(I.SERVICE_TYPE, 'F','Bill Of Supply','A','ALL SERVICES','T','TRANSPORTATION','C','CLEARENCE','R','REBEAT',I.SERVICE_TYPE) SERVICE_TYPE, \n" +
                "    DECODE(II.SERVICE_ID,4,II.BILL_QNTY,0) BILL_QNTY, \n" +
                "    TO_CHAR(INVOICE_DATE,'DD/MM/YYYY') INVOICE_DATE, \n" +
                "    CASE WHEN CM.STATE_CODE='0' THEN II.BILL_RATE * BILL_QNTY ELSE II.BILL_RATE * II.EX_RATE * BILL_QNTY END AMOUNT, \n" +
                "    ROUND(IIT1.TAX_AMT,2) IGST, ROUND(IIT2.TAX_AMT,2) CGST, ROUND(IIT3.TAX_AMT,2) SGST, \n" +
                "    II.BILL_AMOUNT INVOICE_AMOUNT, I.CREATED_BY \n" +
                "  FROM (SELECT DISTINCT TERMINAL_ID, COMPANY_ID, INVOICE_REF_NO, INVOICE_NO, INVOICE_DATE, SERVICE_TYPE, CREATED_BY, CANCLE_FLAGE, BILL_TO \n" +
                "        FROM SPJLIVE.IMP_INVOICE \n" +
                "        WHERE INVOICE_DATE IS NOT NULL AND CANCLE_FLAGE IS NULL) I, \n" +
                "       SPJLIVE.IMP_INVOICE_ITEMS II, \n" +
                "       SPJLIVE.CUSTOMER_MASTER CM, \n" +
                "       SPJLIVE.IMP_INVOICE_TAX IIT1, \n" +
                "       SPJLIVE.IMP_INVOICE_TAX IIT2, \n" +
                "       SPJLIVE.IMP_INVOICE_TAX IIT3, \n" +
                "       SPJLIVE.ALL_PARTY_ACCOUNT AP \n" +
                "  WHERE I.BILL_TO = CM.CUSTOMER_ID \n" +
                "    AND I.INVOICE_NO = II.INVOICE_NO \n" +
                "    AND II.BILL_AMOUNT > 0 \n" +
                "    AND II.LINE_ITEM_ID = AP.CONT_JO_ID(+) \n" +
                "    AND IIT1.TAX_HEAD_ID = 5 AND IIT2.TAX_HEAD_ID = 6 AND IIT3.TAX_HEAD_ID = 7 \n" +
                "    AND IIT1.ITEM_KEY_ID = II.ITEM_KEY_ID AND IIT2.ITEM_KEY_ID = II.ITEM_KEY_ID AND IIT3.ITEM_KEY_ID = II.ITEM_KEY_ID \n" +
                "    AND I.CANCLE_FLAGE IS NULL \n" +
                ")";
            ResultSet rsG = st.executeQuery(qGrand);
            long totalInvoices = 0;
            double baseAmount = 0, igst = 0, sgst = 0, cgst = 0, grossAmount = 0;
            if (rsG.next()) {
                totalInvoices = rsG.getLong("TOTAL_INVOICES");
                baseAmount = rsG.getDouble("TOTAL_BASE_AMOUNT");
                igst = rsG.getDouble("TOTAL_IGST");
                sgst = rsG.getDouble("TOTAL_SGST");
                cgst = rsG.getDouble("TOTAL_CGST");
                grossAmount = rsG.getDouble("TOTAL_GROSS_INVOICE_AMOUNT");
            }

            // 2. All-Time Credit Notes
            System.out.println("2. Extracting Credit Notes...");
            String qCr = 
                "SELECT COUNT(DISTINCT cr.CR_ID) AS CR_COUNT, \n" +
                "       ROUND(SUM(crd.CR_AMOUNT + crd.CR_TAX), 2) AS CR_TOTAL \n" +
                "FROM SPJLIVE.CR_NOTE cr \n" +
                "JOIN SPJLIVE.CR_ITEM_DETAILS crd ON cr.CR_ID = crd.CR_ID \n" +
                "WHERE cr.CANCEL_FLAG IS NULL";
            ResultSet rsCr = st.executeQuery(qCr);
            long crCount = 0;
            double crAmount = 0;
            if (rsCr.next()) {
                crCount = rsCr.getLong("CR_COUNT");
                crAmount = rsCr.getDouble("CR_TOTAL");
            }
            double netRevenue = grossAmount - crAmount;

            // 3. Customer Leaders (Sir's Exact Query)
            System.out.println("3. Extracting Top Customers...");
            String qCust = 
                "SELECT CUSTOMER_NAME, \n" +
                " COUNT(INVOICE_REF_NO) INVOICE_REF_NO, \n" +
                " SUM(AMOUNT) AMOUNT, \n" +
                " SUM(IGST) IGST, \n" +
                " SUM(SGST) SGST, \n" +
                " SUM(CGST) CGST, \n" +
                " SUM(INVOICE_AMOUNT) INVOICE_AMOUNT \n" +
                "FROM(SELECT CUSTOMER_NAME, \n" +
                " COUNT(INVOICE_REF_NO) INVOICE_REF_NO, \n" +
                " SUM(AMOUNT) AMOUNT, \n" +
                " SUM(IGST) IGST, \n" +
                " SUM(SGST) SGST, \n" +
                " SUM(CGST) CGST, \n" +
                " SUM(INVOICE_AMOUNT) INVOICE_AMOUNT \n" +
                "FROM ( \n" +
                "SELECT DISTINCT II.SERVICE_ID,II.IMP_CONT_ID, CM.CUSTOMER_NAME, I.INVOICE_REF_NO, I.INVOICE_NO, BL_NO,PARTY_INV_NO,LINE_HANDOVER_DATE,SAILED,PORT, \n" +
                "DECODE(I.SERVICE_TYPE, 'F','Bill Of Supply','A','ALL SERVICES','T','TRANSPORTATION','C','CLEARENCE','R','REBEAT',I.SERVICE_TYPE)SERVICE_TYPE, \n" +
                "DECODE(II.SERVICE_ID,4,II.BILL_QNTY,0)BILL_QNTY, \n" +
                "TO_CHAR(INVOICE_DATE,'DD/MM/YYYY') INVOICE_DATE, \n" +
                "CASE WHEN CM.STATE_CODE='0' THEN II.BILL_RATE * BILL_QNTY ELSE II.BILL_RATE * II.EX_RATE * BILL_QNTY END AMOUNT, \n" +
                "ROUND(IIT1.TAX_AMT,2) IGST,ROUND(IIT2.TAX_AMT,2) CGST,ROUND(IIT3.TAX_AMT,2) SGST, \n" +
                "II.BILL_AMOUNT INVOICE_AMOUNT, I.CREATED_BY \n" +
                "FROM (SELECT DISTINCT TERMINAL_ID,COMPANY_ID, INVOICE_REF_NO,INVOICE_NO,INVOICE_DATE,SERVICE_TYPE,CREATED_BY,CANCLE_FLAGE,BILL_TO FROM SPJLIVE.IMP_INVOICE \n" +
                "WHERE INVOICE_DATE IS NOT NULL AND CANCLE_FLAGE IS NULL) I, SPJLIVE.IMP_INVOICE_ITEMS II, SPJLIVE.CUSTOMER_MASTER CM,SPJLIVE.IMP_INVOICE_TAX IIT1,SPJLIVE.IMP_INVOICE_TAX IIT2,SPJLIVE.IMP_INVOICE_TAX IIT3 , \n" +
                "SPJLIVE.ALL_PARTY_ACCOUNT AP \n" +
                "WHERE I.BILL_TO =CM.CUSTOMER_ID \n" +
                "AND I.INVOICE_NO=II.INVOICE_NO \n" +
                "AND II.BILL_AMOUNT >0 \n" +
                "AND II.LINE_ITEM_ID=AP.CONT_JO_ID(+) \n" +
                "AND IIT1.TAX_HEAD_ID=5 AND IIT2.TAX_HEAD_ID=6 AND IIT3.TAX_HEAD_ID=7 \n" +
                "AND IIT1.ITEM_KEY_ID=II.ITEM_KEY_ID AND IIT2.ITEM_KEY_ID=II.ITEM_KEY_ID AND IIT3.ITEM_KEY_ID=II.ITEM_KEY_ID \n" +
                "AND I.CANCLE_FLAGE IS NULL \n" +
                ") \n" +
                "GROUP BY CUSTOMER_NAME,BL_NO,PARTY_INV_NO,INVOICE_REF_NO,LINE_HANDOVER_DATE,SAILED,PORT,INVOICE_NO,INVOICE_DATE,BILL_QNTY,SERVICE_TYPE) \n" +
                "GROUP BY CUSTOMER_NAME \n" +
                "ORDER BY INVOICE_AMOUNT DESC";
            ResultSet rsCust = st.executeQuery(qCust);
            StringBuilder custJson = new StringBuilder("[");
            boolean firstC = true;
            int custCount = 0;
            while (rsCust.next()) {
                custCount++;
                if (!firstC) custJson.append(",");
                firstC = false;
                String cName = escapeJson(rsCust.getString("CUSTOMER_NAME"));
                long invs = rsCust.getLong("INVOICE_REF_NO");
                double bAmt = rsCust.getDouble("AMOUNT");
                double cIgst = rsCust.getDouble("IGST");
                double cSgst = rsCust.getDouble("SGST");
                double cCgst = rsCust.getDouble("CGST");
                double gross = rsCust.getDouble("INVOICE_AMOUNT");
                custJson.append(String.format(Locale.US,
                    "{\"customerName\":\"%s\",\"invoiceCount\":%d,\"baseAmount\":%.2f,\"billAmount\":%.2f,\"igst\":%.2f,\"cgst\":%.2f,\"sgst\":%.2f,\"taxAmount\":%.2f,\"grossRevenue\":%.2f}",
                    cName, invs, bAmt, bAmt, cIgst, cCgst, cSgst, (cIgst + cCgst + cSgst), gross));
            }
            custJson.append("]");

            // 4. Terminal Analytics
            System.out.println("4. Extracting Terminal Analytics...");
            String qTerm = 
                "SELECT NVL(TM.TERMINAL_NAME, 'OTHER / UNMAPPED') AS TERMINAL_NAME, \n" +
                "       COUNT(DISTINCT I.INVOICE_REF_NO) AS INVOICES, \n" +
                "       ROUND(SUM(IT.BILL_AMOUNT), 2) AS GROSS_AMOUNT, \n" +
                "       ROUND(SUM(IT.BILL_AMOUNT / 1.18), 2) AS BASE_AMOUNT, \n" +
                "       ROUND(SUM(IT.BILL_AMOUNT - (IT.BILL_AMOUNT / 1.18)), 2) AS TAX_AMOUNT \n" +
                "FROM SPJLIVE.IMP_INVOICE I, \n" +
                "     SPJLIVE.IMP_INVOICE_ITEMS IT, \n" +
                "     SPJLIVE.TERMINAL_MASTER TM \n" +
                "WHERE I.INVOICE_NO = IT.INVOICE_NO \n" +
                "  AND I.LINE_ITEM_ID = IT.LINE_ITEM_ID \n" +
                "  AND I.TERMINAL_ID = TM.TERMINAL_ID(+) \n" +
                "  AND I.CANCLE_FLAGE IS NULL \n" +
                "GROUP BY TM.TERMINAL_NAME \n" +
                "ORDER BY GROSS_AMOUNT DESC";
            ResultSet rsTerm = st.executeQuery(qTerm);
            StringBuilder termJson = new StringBuilder("[");
            boolean firstT = true;
            while (rsTerm.next()) {
                if (!firstT) termJson.append(",");
                firstT = false;
                String tName = escapeJson(rsTerm.getString("TERMINAL_NAME"));
                long invs = rsTerm.getLong("INVOICES");
                double gross = rsTerm.getDouble("GROSS_AMOUNT");
                double bAmt = rsTerm.getDouble("BASE_AMOUNT");
                double tAmt = rsTerm.getDouble("TAX_AMOUNT");
                termJson.append(String.format(Locale.US,
                    "{\"terminalName\":\"%s\",\"invoiceCount\":%d,\"billAmount\":%.2f,\"taxAmount\":%.2f,\"grossRevenue\":%.2f}",
                    tName, invs, bAmt, tAmt, gross));
            }
            termJson.append("]");

            // 5. Service & Tariff Analytics
            System.out.println("5. Extracting Service / Tariff Analytics...");
            String qServ = 
                "SELECT NVL(SM.SERVICE_NAME, 'OTHER LOGISTICS') AS SERVICE_NAME, \n" +
                "       COUNT(DISTINCT IT.LINE_ITEM_ID) AS ITEM_COUNT, \n" +
                "       ROUND(SUM(IT.BILL_AMOUNT), 2) AS GROSS_AMOUNT, \n" +
                "       ROUND(SUM(IT.BILL_AMOUNT / 1.18), 2) AS BASE_AMOUNT, \n" +
                "       ROUND(SUM(IT.BILL_AMOUNT - (IT.BILL_AMOUNT / 1.18)), 2) AS TAX_AMOUNT \n" +
                "FROM SPJLIVE.IMP_INVOICE_ITEMS IT, \n" +
                "     SPJLIVE.IMP_INVOICE I, \n" +
                "     SPJLIVE.SERVICE_MASTER SM \n" +
                "WHERE IT.INVOICE_NO = I.INVOICE_NO \n" +
                "  AND IT.LINE_ITEM_ID = I.LINE_ITEM_ID \n" +
                "  AND IT.SERVICE_ID = SM.SERVICE_ID(+) \n" +
                "  AND I.CANCLE_FLAGE IS NULL \n" +
                "  AND IT.BILL_AMOUNT > 0 \n" +
                "GROUP BY SM.SERVICE_NAME \n" +
                "ORDER BY GROSS_AMOUNT DESC";
            ResultSet rsServ = st.executeQuery(qServ);
            StringBuilder servJson = new StringBuilder("[");
            boolean firstS = true;
            while (rsServ.next()) {
                if (!firstS) servJson.append(",");
                firstS = false;
                String sName = escapeJson(rsServ.getString("SERVICE_NAME"));
                long items = rsServ.getLong("ITEM_COUNT");
                double gross = rsServ.getDouble("GROSS_AMOUNT");
                double bAmt = rsServ.getDouble("BASE_AMOUNT");
                double tAmt = rsServ.getDouble("TAX_AMOUNT");
                servJson.append(String.format(Locale.US,
                    "{\"serviceName\":\"%s\",\"itemCount\":%d,\"billAmount\":%.2f,\"taxAmount\":%.2f,\"grossRevenue\":%.2f}",
                    sName, items, bAmt, tAmt, gross));
            }
            servJson.append("]");

            // Build full Data Warehouse JSON payload
            String finalJson = String.format(Locale.US,
                "{\n" +
                "  \"source\": \"ORACLE_SPJLIVE\",\n" +
                "  \"generatedAt\": \"%s\",\n" +
                "  \"queryExecutionTimeMs\": %d,\n" +
                "  \"allTimeGrandTotals\": {\n" +
                "    \"totalActiveInvoices\": %d,\n" +
                "    \"baseTaxableAmount\": %.2f,\n" +
                "    \"igstTax\": %.2f,\n" +
                "    \"cgstTax\": %.2f,\n" +
                "    \"sgstTax\": %.2f,\n" +
                "    \"totalStatutoryGst\": %.2f,\n" +
                "    \"grossInvoicedAmount\": %.2f,\n" +
                "    \"creditNotesCount\": %d,\n" +
                "    \"creditNotesAmount\": %.2f,\n" +
                "    \"netRealizedRevenue\": %.2f\n" +
                "  },\n" +
                "  \"topCustomers\": %s,\n" +
                "  \"terminals\": %s,\n" +
                "  \"topServices\": %s\n" +
                "}",
                new java.util.Date().toString(),
                (System.currentTimeMillis() - startTime),
                totalInvoices, baseAmount, igst, cgst, sgst, (igst + cgst + sgst), grossAmount, crCount, crAmount, netRevenue,
                custJson.toString(), termJson.toString(), servJson.toString()
            );

            // Write to dataWarehouse.json (supports both monorepo and standalone backend)
            File outFile = new File("backend/src/data/dataWarehouse.json");
            if (!outFile.getParentFile().exists()) {
                outFile = new File("src/data/dataWarehouse.json");
            }
            outFile.getParentFile().mkdirs();
            try (FileWriter fw = new FileWriter(outFile)) {
                fw.write(finalJson);
            }
            System.out.println("Data Warehouse successfully created at: " + outFile.getAbsolutePath());
            System.out.println("Total Time: " + (System.currentTimeMillis() - startTime) + " ms");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
