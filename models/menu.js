const { sql, getPool } = require("../db");

const get_menus = async (patient_id) => {
    
    const pool = await getPool();
    
    const result = await pool.request()
            .input('Patient_ID', sql.Int, patient_id)
            .query(`SELECT 
                    c.PortalCategories_ID, 
                    c.PortalCategoriesName, 
                    c.PortalCategoriesLongDescription, 
                    c.PortalCategoriesURL, 
                    c.PortalCategoriesDescription AS PortalCategoriesDescription, 
                    p.PortalComponents_ID, 
                    p.PortalComponentsName, 
                    p.PortalComponentsURL, 
                    p.PortalComponentsDescription, 
                    p.ExternalLink,
                    ISNULL(ch.Hidden, 1) AS Hidden   -- no choice row = not selected (Hidden 1); 0 = selected/visible
                FROM [Wellness_eCastEMR_Data].[dbo].[PortalCategories] c
                LEFT JOIN [Wellness_eCastEMR_Data].[dbo].[PortalComponents] p
                    ON p.PortalCategories_ID = c.PortalCategories_ID
                  AND ISNULL(p.Hidden, 0) = 0
                LEFT JOIN [Wellness_eCastEMR_Data].[dbo].[PortalComponentsChoices] ch
                    ON ch.PortalComponents_ID = p.PortalComponents_ID
                  AND ch.Patient_ID = @Patient_ID
                WHERE ISNULL(c.Hidden, 0) = 0
                ORDER BY c.SortOrder, c.PortalCategories_ID, ISNULL(p.SortOrder, 0); 
            `);

    return result;
};

/** Known patient column names on tempPortalAISource (SQL Server preserves column casing in recordset keys). */
const TEMP_AI_PATIENT_KEY_CANDIDATES = [
    "Patient_ID",
    "PatientId",
    "patient_id",
    "PatientID",
    "PatID",
    "Pat_Id",
];

function resolveTempAiPatientColumn(rows) {
    const fromEnv = process.env.TEMP_PORTAL_AI_PATIENT_COLUMN?.trim();
    if (fromEnv) {
        return fromEnv;
    }
    if (!rows.length) {
        return null;
    }
    const keys = Object.keys(rows[0]);
    const byLower = new Map(keys.map((k) => [k.toLowerCase(), k]));
    for (const c of TEMP_AI_PATIENT_KEY_CANDIDATES) {
        const k = byLower.get(c.toLowerCase());
        if (k) {
            return k;
        }
    }
    return null;
}

/**
 * All rows from tempPortalAISource, optionally scoped to patient_id when a patient column exists.
 * Does not use SQL WHERE on Patient_ID (that column may not exist on the table).
 */
const get_temp_portal_ai_source = async (patient_id) => {
    const pool = await getPool();
    try {
        const result = await pool.request().query(
            `SELECT * FROM [Wellness_eCastEMR_Data].[dbo].[tempPortalAISource]`
        );
        const rows = result.recordset || [];
        const col = resolveTempAiPatientColumn(rows);
        if (!col) {
            return rows;
        }
        const pid = Number(patient_id);
        return rows.filter(
            (row) => row[col] == null || Number(row[col]) === pid
        );
    } catch (err) {
        console.warn("get_temp_portal_ai_source failed:", err.message);
        return [];
    }
};

/** Visible portal components for OpenAI catalog (matches your reference query). */
const get_portal_components_catalog = async () => {
    const pool = await getPool();
    const result = await pool.request().query(
        `SELECT 
            PortalComponents_ID,
            PortalCategories_ID,
            PortalComponentsName,
            PortalComponentsDescription,
            PortalComponentsURL,
            ExternalLink,
            SortOrder
        FROM [Wellness_eCastEMR_Data].[dbo].[PortalComponents]
        WHERE (Hidden IS NULL OR Hidden = 0)
        ORDER BY SortOrder`
    );
    return result.recordset || [];
};

module.exports = {
    get_menus,
    get_temp_portal_ai_source,
    get_portal_components_catalog,
};