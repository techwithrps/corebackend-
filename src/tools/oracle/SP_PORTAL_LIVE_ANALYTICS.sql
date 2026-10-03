-- ============================================================================
-- ORACLE STORED PROCEDURE: SPJLIVE.SP_PORTAL_LIVE_ANALYTICS
-- Schema: SPJLIVE
-- Single Source of Truth for SPJ Logistics Financial & Operational Analytics
-- ============================================================================

CREATE OR REPLACE PROCEDURE SPJLIVE.SP_PORTAL_LIVE_ANALYTICS (
    p_FROM_DATE     IN  VARCHAR2, 
    p_TO_DATE       IN  VARCHAR2, 
    p_COMPANY_ID    IN  NUMBER DEFAULT 0, 
    p_TERMINAL_ID   IN  NUMBER DEFAULT 0, 
    p_CUSTOMER_ID   IN  NUMBER DEFAULT 0, 
    p_SERVICE_TYPE  IN  VARCHAR2 DEFAULT 'ALL', 
    p_KPI_CURSOR    OUT SYS_REFCURSOR, 
    p_CUST_CURSOR   OUT SYS_REFCURSOR, 
    p_TERM_CURSOR   OUT SYS_REFCURSOR  
) AS 
    v_from_date DATE := NULL;
    v_to_date   DATE := NULL;
BEGIN
    -- 100% Dynamic User-Driven Date Filtering:
    -- If user provides date range, filter by it.
    -- If no date range provided (or 'all' / null), dates remain NULL -> queries OVERALL / ALL-TIME data.
    IF p_FROM_DATE IS NOT NULL AND TRIM(p_FROM_DATE) IS NOT NULL AND LOWER(TRIM(p_FROM_DATE)) != 'null' AND LOWER(TRIM(p_FROM_DATE)) != 'all' AND LOWER(TRIM(p_FROM_DATE)) != 'undefined' THEN
        IF INSTR(p_FROM_DATE, '-') > 0 THEN
            v_from_date := TO_DATE(SUBSTR(TRIM(p_FROM_DATE), 1, 10), 'YYYY-MM-DD');
        ELSE
            v_from_date := TO_DATE(SUBSTR(TRIM(p_FROM_DATE), 1, 10), 'DD/MM/YYYY');
        END IF;
    ELSE
        v_from_date := NULL;
    END IF;

    IF p_TO_DATE IS NOT NULL AND TRIM(p_TO_DATE) IS NOT NULL AND LOWER(TRIM(p_TO_DATE)) != 'null' AND LOWER(TRIM(p_TO_DATE)) != 'all' AND LOWER(TRIM(p_TO_DATE)) != 'undefined' THEN
        IF INSTR(p_TO_DATE, '-') > 0 THEN
            v_to_date := TO_DATE(SUBSTR(TRIM(p_TO_DATE), 1, 10) || ' 23:59:59', 'YYYY-MM-DD HH24:MI:SS');
        ELSE
            v_to_date := TO_DATE(SUBSTR(TRIM(p_TO_DATE), 1, 10) || ' 23:59:59', 'DD/MM/YYYY HH24:MI:SS');
        END IF;
    ELSE
        v_to_date := NULL;
    END IF;

    -- ========================================================
    -- 1. OVERALL KPIS (Exact User Logic Matching To The Penny)
    -- ========================================================
    OPEN p_KPI_CURSOR FOR
        SELECT /*+ PARALLEL(4) */
            NVL(ROUND(SUM(AMOUNT), 2), 0)           AS TOTAL_TAXABLE_AMOUNT,
            NVL(ROUND(SUM(IGST), 2), 0)             AS TOTAL_IGST,
            NVL(ROUND(SUM(SGST), 2), 0)             AS TOTAL_SGST,
            NVL(ROUND(SUM(CGST), 2), 0)             AS TOTAL_CGST,
            NVL(ROUND(SUM(INVOICE_AMOUNT), 2), 0)   AS TOTAL_GROSS_AMOUNT,
            COUNT(DISTINCT INVOICE_NO)              AS TOTAL_INVOICES,
            COUNT(DISTINCT INVOICE_REF_NO)          AS TOTAL_JOBS,
            COUNT(DISTINCT IMP_CONT_ID)             AS TOTAL_CONTAINERS
        FROM (
            SELECT DISTINCT II.SERVICE_ID, II.IMP_CONT_ID, CM.CUSTOMER_NAME, I.INVOICE_REF_NO, I.INVOICE_NO, BL_NO, PARTY_INV_NO, LINE_HANDOVER_DATE, SAILED, PORT,
                DECODE(I.SERVICE_TYPE, 'F','Bill Of Supply','A','ALL SERVICES','T','TRANSPORTATION','C','CLEARENCE','R','REBEAT',I.SERVICE_TYPE) AS SERVICE_TYPE,
                DECODE(II.SERVICE_ID,4,II.BILL_QNTY,0) AS BILL_QNTY,
                TO_CHAR(I.INVOICE_DATE,'DD/MM/YYYY') AS INVOICE_DATE,
                CASE WHEN CM.STATE_CODE='0' THEN II.BILL_RATE * BILL_QNTY ELSE II.BILL_RATE * II.EX_RATE * BILL_QNTY END AS AMOUNT,
                ROUND(IIT1.TAX_AMT,2) AS IGST, ROUND(IIT2.TAX_AMT,2) AS CGST, ROUND(IIT3.TAX_AMT,2) AS SGST,
                II.BILL_AMOUNT AS INVOICE_AMOUNT
            FROM 
                SPJLIVE.IMP_INVOICE I,
                SPJLIVE.IMP_INVOICE_ITEMS II,
                SPJLIVE.CUSTOMER_MASTER CM,
                SPJLIVE.IMP_INVOICE_TAX IIT1,
                SPJLIVE.IMP_INVOICE_TAX IIT2,
                SPJLIVE.IMP_INVOICE_TAX IIT3,
                SPJLIVE.ALL_PARTY_ACCOUNT AP
            WHERE I.BILL_TO = CM.CUSTOMER_ID
              AND I.INVOICE_NO = II.INVOICE_NO
              AND II.BILL_AMOUNT > 0
              AND II.LINE_ITEM_ID = AP.CONT_JO_ID(+)
              AND IIT1.TAX_HEAD_ID = 5 AND IIT2.TAX_HEAD_ID = 6 AND IIT3.TAX_HEAD_ID = 7
              AND IIT1.ITEM_KEY_ID = II.ITEM_KEY_ID AND IIT2.ITEM_KEY_ID = II.ITEM_KEY_ID AND IIT3.ITEM_KEY_ID = II.ITEM_KEY_ID
              AND I.CANCLE_FLAGE IS NULL
              AND (v_from_date IS NULL OR I.INVOICE_DATE >= v_from_date)
              AND (v_to_date IS NULL OR I.INVOICE_DATE <= v_to_date)
              AND (p_COMPANY_ID IS NULL OR p_COMPANY_ID = 0 OR I.COMPANY_ID = p_COMPANY_ID)
              AND (p_TERMINAL_ID IS NULL OR p_TERMINAL_ID = 0 OR I.TERMINAL_ID = p_TERMINAL_ID)
              AND (p_CUSTOMER_ID IS NULL OR p_CUSTOMER_ID = 0 OR I.BILL_TO = p_CUSTOMER_ID)
              AND (p_SERVICE_TYPE IS NULL OR p_SERVICE_TYPE = 'ALL' OR p_SERVICE_TYPE = '0' OR I.SERVICE_TYPE = p_SERVICE_TYPE)
        );

    -- =================================================================
    -- 2. CUSTOMER LEADERBOARD (Exact User DBeaver Query Matching)
    -- =================================================================
    OPEN p_CUST_CURSOR FOR
        SELECT /*+ PARALLEL(4) */
            CUSTOMER_NAME,
            COUNT(INVOICE_REF_NO) AS INVOICE_COUNT,
            COUNT(IMP_CONT_ID)    AS CONTAINER_COUNT,
            SUM(AMOUNT)           AS AMOUNT,
            SUM(IGST)             AS IGST,
            SUM(SGST)             AS SGST,
            SUM(CGST)             AS CGST,
            SUM(INVOICE_AMOUNT)   AS INVOICE_AMOUNT
        FROM (
            SELECT 
                CUSTOMER_NAME, BL_NO, PARTY_INV_NO, INVOICE_REF_NO, LINE_HANDOVER_DATE, SAILED, PORT, INVOICE_NO, INVOICE_DATE, BILL_QNTY, SERVICE_TYPE,
                MAX(IMP_CONT_ID) AS IMP_CONT_ID,
                SUM(AMOUNT) AS AMOUNT,
                SUM(IGST) AS IGST,
                SUM(SGST) AS SGST,
                SUM(CGST) AS CGST,
                SUM(INVOICE_AMOUNT) AS INVOICE_AMOUNT
            FROM (
                SELECT DISTINCT II.SERVICE_ID, II.IMP_CONT_ID, CM.CUSTOMER_NAME, I.INVOICE_REF_NO, I.INVOICE_NO, BL_NO, PARTY_INV_NO, LINE_HANDOVER_DATE, SAILED, PORT,
                    DECODE(I.SERVICE_TYPE, 'F','Bill Of Supply','A','ALL SERVICES','T','TRANSPORTATION','C','CLEARENCE','R','REBEAT',I.SERVICE_TYPE) AS SERVICE_TYPE,
                    DECODE(II.SERVICE_ID,4,II.BILL_QNTY,0) AS BILL_QNTY,
                    TO_CHAR(I.INVOICE_DATE,'DD/MM/YYYY') AS INVOICE_DATE,
                    CASE WHEN CM.STATE_CODE='0' THEN II.BILL_RATE * BILL_QNTY ELSE II.BILL_RATE * II.EX_RATE * BILL_QNTY END AS AMOUNT,
                    ROUND(IIT1.TAX_AMT,2) AS IGST, ROUND(IIT2.TAX_AMT,2) AS CGST, ROUND(IIT3.TAX_AMT,2) AS SGST,
                    II.BILL_AMOUNT AS INVOICE_AMOUNT
                FROM 
                    SPJLIVE.IMP_INVOICE I,
                    SPJLIVE.IMP_INVOICE_ITEMS II,
                    SPJLIVE.CUSTOMER_MASTER CM,
                    SPJLIVE.IMP_INVOICE_TAX IIT1,
                    SPJLIVE.IMP_INVOICE_TAX IIT2,
                    SPJLIVE.IMP_INVOICE_TAX IIT3,
                    SPJLIVE.ALL_PARTY_ACCOUNT AP
                WHERE I.BILL_TO = CM.CUSTOMER_ID
                  AND I.INVOICE_NO = II.INVOICE_NO
                  AND II.BILL_AMOUNT > 0
                  AND II.LINE_ITEM_ID = AP.CONT_JO_ID(+)
                  AND IIT1.TAX_HEAD_ID = 5 AND IIT2.TAX_HEAD_ID = 6 AND IIT3.TAX_HEAD_ID = 7
                  AND IIT1.ITEM_KEY_ID = II.ITEM_KEY_ID AND IIT2.ITEM_KEY_ID = II.ITEM_KEY_ID AND IIT3.ITEM_KEY_ID = II.ITEM_KEY_ID
                  AND I.CANCLE_FLAGE IS NULL
                  AND (v_from_date IS NULL OR I.INVOICE_DATE >= v_from_date)
                  AND (v_to_date IS NULL OR I.INVOICE_DATE <= v_to_date)
                  AND (p_COMPANY_ID IS NULL OR p_COMPANY_ID = 0 OR I.COMPANY_ID = p_COMPANY_ID)
                  AND (p_TERMINAL_ID IS NULL OR p_TERMINAL_ID = 0 OR I.TERMINAL_ID = p_TERMINAL_ID)
                  AND (p_CUSTOMER_ID IS NULL OR p_CUSTOMER_ID = 0 OR I.BILL_TO = p_CUSTOMER_ID)
                  AND (p_SERVICE_TYPE IS NULL OR p_SERVICE_TYPE = 'ALL' OR p_SERVICE_TYPE = '0' OR I.SERVICE_TYPE = p_SERVICE_TYPE)
            )
            GROUP BY CUSTOMER_NAME, BL_NO, PARTY_INV_NO, INVOICE_REF_NO, LINE_HANDOVER_DATE, SAILED, PORT, INVOICE_NO, INVOICE_DATE, BILL_QNTY, SERVICE_TYPE
        )
        GROUP BY CUSTOMER_NAME
        ORDER BY INVOICE_AMOUNT DESC;

    -- ========================================================
    -- 3. TERMINAL BREAKDOWN (Exact User Logic)
    -- ========================================================
    OPEN p_TERM_CURSOR FOR
        SELECT /*+ PARALLEL(4) */
            SUB.TERMINAL_ID,
            NVL(TM.TERMINAL_NAME, 'OTHER') AS TERMINAL_NAME,
            COUNT(DISTINCT SUB.INVOICE_REF_NO) AS INVOICE_COUNT,
            COUNT(DISTINCT SUB.IMP_CONT_ID)    AS CONTAINER_COUNT,
            ROUND(SUM(SUB.AMOUNT), 2)          AS AMOUNT,
            ROUND(SUM(SUB.INVOICE_AMOUNT), 2)  AS INVOICE_AMOUNT
        FROM (
            SELECT DISTINCT I.TERMINAL_ID, II.SERVICE_ID, II.IMP_CONT_ID, CM.CUSTOMER_NAME, I.INVOICE_REF_NO, I.INVOICE_NO, BL_NO, PARTY_INV_NO, LINE_HANDOVER_DATE, SAILED, PORT,
                DECODE(I.SERVICE_TYPE, 'F','Bill Of Supply','A','ALL SERVICES','T','TRANSPORTATION','C','CLEARENCE','R','REBEAT',I.SERVICE_TYPE) AS SERVICE_TYPE,
                DECODE(II.SERVICE_ID,4,II.BILL_QNTY,0) AS BILL_QNTY,
                TO_CHAR(I.INVOICE_DATE,'DD/MM/YYYY') AS INVOICE_DATE,
                CASE WHEN CM.STATE_CODE='0' THEN II.BILL_RATE * BILL_QNTY ELSE II.BILL_RATE * II.EX_RATE * BILL_QNTY END AS AMOUNT,
                ROUND(IIT1.TAX_AMT,2) AS IGST, ROUND(IIT2.TAX_AMT,2) AS CGST, ROUND(IIT3.TAX_AMT,2) AS SGST,
                II.BILL_AMOUNT AS INVOICE_AMOUNT
            FROM 
                SPJLIVE.IMP_INVOICE I,
                SPJLIVE.IMP_INVOICE_ITEMS II,
                SPJLIVE.CUSTOMER_MASTER CM,
                SPJLIVE.IMP_INVOICE_TAX IIT1,
                SPJLIVE.IMP_INVOICE_TAX IIT2,
                SPJLIVE.IMP_INVOICE_TAX IIT3,
                SPJLIVE.ALL_PARTY_ACCOUNT AP
            WHERE I.BILL_TO = CM.CUSTOMER_ID
              AND I.INVOICE_NO = II.INVOICE_NO
              AND II.BILL_AMOUNT > 0
              AND II.LINE_ITEM_ID = AP.CONT_JO_ID(+)
              AND IIT1.TAX_HEAD_ID = 5 AND IIT2.TAX_HEAD_ID = 6 AND IIT3.TAX_HEAD_ID = 7
              AND IIT1.ITEM_KEY_ID = II.ITEM_KEY_ID AND IIT2.ITEM_KEY_ID = II.ITEM_KEY_ID AND IIT3.ITEM_KEY_ID = II.ITEM_KEY_ID
              AND I.CANCLE_FLAGE IS NULL
              AND (v_from_date IS NULL OR I.INVOICE_DATE >= v_from_date)
              AND (v_to_date IS NULL OR I.INVOICE_DATE <= v_to_date)
              AND (p_COMPANY_ID IS NULL OR p_COMPANY_ID = 0 OR I.COMPANY_ID = p_COMPANY_ID)
              AND (p_TERMINAL_ID IS NULL OR p_TERMINAL_ID = 0 OR I.TERMINAL_ID = p_TERMINAL_ID)
              AND (p_CUSTOMER_ID IS NULL OR p_CUSTOMER_ID = 0 OR I.BILL_TO = p_CUSTOMER_ID)
              AND (p_SERVICE_TYPE IS NULL OR p_SERVICE_TYPE = 'ALL' OR p_SERVICE_TYPE = '0' OR I.SERVICE_TYPE = p_SERVICE_TYPE)
        ) SUB
        LEFT JOIN SPJLIVE.TERMINAL_MASTER TM ON SUB.TERMINAL_ID = TM.TERMINAL_ID
        GROUP BY SUB.TERMINAL_ID, TM.TERMINAL_NAME
        ORDER BY INVOICE_AMOUNT DESC;
END SP_PORTAL_LIVE_ANALYTICS;
/
