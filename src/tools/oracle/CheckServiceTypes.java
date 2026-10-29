import java.sql.*;

public class CheckServiceTypes {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:oracle:thin:@//141.148.207.57:1521/pdb1.sub10181056240.elogisolpublicv.oraclevcn.com";
        try (Connection c = DriverManager.getConnection(url, "SPJLIVE", "SPjlive_0112#");
             Statement s = c.createStatement();
             ResultSet rs = s.executeQuery(
                 "SELECT SERVICE_TYPE, COUNT(*) as CNT " +
                 "FROM SPJLIVE.IMP_INVOICE " +
                 "WHERE CREATED_ON >= TO_DATE('01-04-2023','DD-MM-YYYY') " +
                 "GROUP BY SERVICE_TYPE ORDER BY CNT DESC"
             )) {
            System.out.println("SERVICE_TYPE COUNTS:");
            while (rs.next()) {
                System.out.println(rs.getString("SERVICE_TYPE") + ": " + rs.getInt("CNT"));
            }
        }
    }
}
