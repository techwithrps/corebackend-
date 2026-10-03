import java.sql.*;

public class CheckServiceMaster {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:oracle:thin:@//144.24.138.129:1521/pdb1.sub06121018360.prodvcn.oraclevcn.com";
        try (Connection c = DriverManager.getConnection(url, "SPJLIVE", "SPjlive_0112#");
             Statement s = c.createStatement();
             ResultSet rs = s.executeQuery(
                 "SELECT DISTINCT I.SERVICE_TYPE, SM.SERVICE_NAME, COUNT(*) as CNT " +
                 "FROM SPJLIVE.IMP_INVOICE I " +
                 "JOIN SPJLIVE.IMP_INVOICE_ITEMS IT ON I.INVOICE_NO = IT.INVOICE_NO " +
                 "JOIN SPJLIVE.SERVICE_MASTER SM ON IT.SERVICE_ID = SM.SERVICE_ID " +
                 "WHERE I.CREATED_ON >= TO_DATE('01-04-2025','DD-MM-YYYY') " +
                 "GROUP BY I.SERVICE_TYPE, SM.SERVICE_NAME " +
                 "HAVING COUNT(*) > 100 " +
                 "ORDER BY I.SERVICE_TYPE, CNT DESC"
             )) {
            System.out.println("SERVICE MAPPINGS:");
            while (rs.next()) {
                System.out.printf("%s | %-40s | %d%n", rs.getString("SERVICE_TYPE"), rs.getString("SERVICE_NAME"), rs.getInt("CNT"));
            }
        }
    }
}
