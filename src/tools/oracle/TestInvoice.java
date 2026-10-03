import java.sql.*;

public class TestInvoice {
    public static void main(String[] args) {
        String url = "jdbc:oracle:thin:@//144.24.138.129:1521/pdb1.sub06121018360.prodvcn.oraclevcn.com";
        String user = "SPJLIVE";
        String pass = "SPjlive_0112#";

        try (Connection c = DriverManager.getConnection(url, user, pass);
             Statement s = c.createStatement();
             ResultSet rs = s.executeQuery(
                 "SELECT I.INVOICE_NO, I.INVOICE_REF_NO, I.SERVICE_TYPE, IT.SERVICE_ID, " +
                 "       SM.SERVICE_NAME, AP.CONT_TYPE, AP.CONT_SIZE, AP.CONT_NO, " +
                 "       IT.BILL_AMOUNT, IT.BILL_RATE, IT.BILL_QNTY " +
                 "FROM SPJLIVE.IMP_INVOICE I " +
                 "LEFT JOIN SPJLIVE.IMP_INVOICE_ITEMS IT ON I.INVOICE_NO = IT.INVOICE_NO " +
                 "LEFT JOIN SPJLIVE.SERVICE_MASTER SM ON IT.SERVICE_ID = SM.SERVICE_ID " +
                 "LEFT JOIN SPJLIVE.ALL_PARTY_ACCOUNT AP ON IT.LINE_ITEM_ID = AP.CONT_JO_ID " +
                 "WHERE I.INVOICE_NO = 244132 OR I.INVOICE_REF_NO LIKE '%11677%' OR AP.CONT_NO = 'TLLU1066673'"
             )) {
            
            System.out.println("--- QUERY RESULTS ---");
            boolean found = false;
            while (rs.next()) {
                found = true;
                System.out.println("INVOICE_NO: " + rs.getString("INVOICE_NO"));
                System.out.println("INVOICE_REF_NO: " + rs.getString("INVOICE_REF_NO"));
                System.out.println("SERVICE_TYPE: " + rs.getString("SERVICE_TYPE"));
                System.out.println("SERVICE_ID: " + rs.getString("SERVICE_ID"));
                System.out.println("SERVICE_NAME: " + rs.getString("SERVICE_NAME"));
                System.out.println("CONT_TYPE: " + rs.getString("CONT_TYPE"));
                System.out.println("CONT_SIZE: " + rs.getString("CONT_SIZE"));
                System.out.println("CONT_NO: " + rs.getString("CONT_NO"));
                System.out.println("BILL_AMOUNT: " + rs.getDouble("BILL_AMOUNT"));
                System.out.println("BILL_RATE: " + rs.getDouble("BILL_RATE"));
                System.out.println("BILL_QNTY: " + rs.getDouble("BILL_QNTY"));
                System.out.println("--------------------");
            }
            if (!found) {
                System.out.println("No matching invoice found for 244132 / 11677 / TLLU1066673");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
