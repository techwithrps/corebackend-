import java.sql.*;

public class CheckProcedures {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:oracle:thin:@//141.148.207.57:1521/pdb1.sub10181056240.elogisolpublicv.oraclevcn.com";
        try (Connection c = DriverManager.getConnection(url, "SPJLIVE", "SPjlive_0112#");
             Statement s = c.createStatement();
             ResultSet rs = s.executeQuery(
                 "SELECT OBJECT_NAME, OBJECT_TYPE, STATUS " +
                 "FROM ALL_OBJECTS " +
                 "WHERE OWNER = 'SPJLIVE' AND OBJECT_TYPE IN ('PROCEDURE', 'PACKAGE') " +
                 "ORDER BY OBJECT_NAME"
             )) {
            System.out.println("PROCEDURES & PACKAGES IN SPJLIVE:");
            while (rs.next()) {
                System.out.printf("%-12s | %-35s | %s%n", rs.getString("OBJECT_TYPE"), rs.getString("OBJECT_NAME"), rs.getString("STATUS"));
            }
        }
    }
}
