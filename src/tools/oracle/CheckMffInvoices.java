import java.sql.*;

public class CheckMffInvoices {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:oracle:thin:@//144.24.138.129:1521/pdb1.sub06121018360.prodvcn.oraclevcn.com";
        try (Connection c = DriverManager.getConnection(url, "SPJLIVE", "SPjlive_0112#");
             Statement s = c.createStatement();
             ResultSet rs = s.executeQuery(
                 "SELECT I.INVOICE_NO, I.INVOICE_REF_NO, I.SERVICE_TYPE, " +
                 "       (SELECT SM.SERVICE_NAME " +
                 "        FROM SPJLIVE.IMP_INVOICE_ITEMS IT " +
                 "        JOIN SPJLIVE.SERVICE_MASTER SM ON IT.SERVICE_ID = SM.SERVICE_ID " +
                 "        WHERE IT.INVOICE_NO = I.INVOICE_NO AND (IT.BILL_AMOUNT > 0 OR ROWNUM = 1) AND ROWNUM = 1) as SERVICE_NAME " +
                 "FROM SPJLIVE.IMP_INVOICE I " +
                 "WHERE I.INVOICE_REF_NO IN ('SPJ/D26-27/11677', 'SPJ/TP26-27/4694', 'SPJ/D26-27/11625', 'SPJ/D26-27/11624', 'SPJ/TP26-27/4665', 'SPJ/TP26-27/4662') " +
                 "ORDER BY I.INVOICE_NO DESC"
             )) {
            System.out.println("ORACLE DATA FOR INVOICES:");
            while (rs.next()) {
                System.out.printf("REF: %-18s | TYPE: %s | SERVICE: %s%n",
                    rs.getString("INVOICE_REF_NO"),
                    rs.getString("SERVICE_TYPE"),
                    rs.getString("SERVICE_NAME")
                );
            }
        }
    }
}
