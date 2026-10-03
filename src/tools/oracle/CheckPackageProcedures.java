import java.sql.*;

public class CheckPackageProcedures {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:oracle:thin:@//144.24.138.129:1521/pdb1.sub06121018360.prodvcn.oraclevcn.com";
        try (Connection c = DriverManager.getConnection(url, "SPJLIVE", "SPjlive_0112#");
             Statement s = c.createStatement();
             ResultSet rs = s.executeQuery(
                 "SELECT OBJECT_NAME, PROCEDURE_NAME " +
                 "FROM ALL_PROCEDURES " +
                 "WHERE OWNER = 'SPJLIVE' AND OBJECT_NAME IN ('REPORT_PKG', 'SELECT_PKG', 'SELECT_PKG_NO_OBJ') " +
                 "AND PROCEDURE_NAME IS NOT NULL " +
                 "ORDER BY OBJECT_NAME, PROCEDURE_NAME"
             )) {
            System.out.println("PROCEDURES INSIDE PACKAGES:");
            while (rs.next()) {
                System.out.printf("%-20s | %s%n", rs.getString("OBJECT_NAME"), rs.getString("PROCEDURE_NAME"));
            }
        }
    }
}
