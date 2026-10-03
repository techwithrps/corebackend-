import java.sql.*;

public class CheckLatestDates {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:oracle:thin:@//144.24.138.129:1521/pdb1.sub06121018360.prodvcn.oraclevcn.com";
        try (Connection c = DriverManager.getConnection(url, "SPJLIVE", "SPjlive_0112#");
             Statement s = c.createStatement()) {
            
            ResultSet rs1 = s.executeQuery(
                "SELECT MAX(CREATED_ON) as MAX_CREATED, MAX(INVOICE_DATE) as MAX_INV_DATE, COUNT(*) as CNT " +
                "FROM SPJLIVE.IMP_INVOICE " +
                "WHERE CREATED_ON >= TO_DATE('01-09-2026', 'DD-MM-YYYY')"
            );
            if (rs1.next()) {
                System.out.println("IMP_INVOICE in Sep-Oct 2026:");
                System.out.println("MAX_CREATED: " + rs1.getTimestamp("MAX_CREATED"));
                System.out.println("MAX_INV_DATE: " + rs1.getTimestamp("MAX_INV_DATE"));
                System.out.println("COUNT: " + rs1.getInt("CNT"));
            }
            
            ResultSet rs2 = s.executeQuery(
                "SELECT TO_CHAR(CREATED_ON, 'YYYY-MM-DD') as CDAY, COUNT(*) as CNT " +
                "FROM SPJLIVE.IMP_INVOICE " +
                "WHERE CREATED_ON >= TO_DATE('20-09-2026', 'DD-MM-YYYY') " +
                "GROUP BY TO_CHAR(CREATED_ON, 'YYYY-MM-DD') " +
                "ORDER BY CDAY DESC"
            );
            System.out.println("\nDAILY INVOICE COUNTS RECENT:");
            while (rs2.next()) {
                System.out.println(rs2.getString("CDAY") + ": " + rs2.getInt("CNT"));
            }
        }
    }
}
