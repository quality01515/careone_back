const { sql, getPool } = require("../db");

const DB = "[Wellness_eCastEMR_Data].[dbo]";
const DB_TEMPLATE = "[Wellness_eCastEMR_Template].[dbo]";

/**
 * Latest HRA encounter for patient per spec: EncounterHistory with Hidden filter, newest Encounter_ID.
 * @returns {Promise<number|null>}
 */
async function getLatestHraEncounterId(patient_id) {
    const pool = await getPool();
    const result = await pool
        .request()
        .input("Patient_ID", sql.Int, patient_id)
        .query(
            `SELECT TOP (1) Encounter_ID
             FROM ${DB}.[EncounterHistory]
             WHERE Patient_ID = @Patient_ID
               AND (Hidden IS NOT NULL OR Hidden = 0)
             ORDER BY Encounter_ID DESC`
        );
    const row = result.recordset?.[0];
    return row?.Encounter_ID != null ? Number(row.Encounter_ID) : null;
}

/**
 * HRA considered present only if ETL has rows for the encounter.
 * @returns {Promise<boolean>}
 */
async function encounterHasEtl(encounter_id) {
    const pool = await getPool();
    const result = await pool
        .request()
        .input("Encounter_ID", sql.Int, encounter_id)
        .query(
            `SELECT TOP (1) 1 AS ok
             FROM ${DB}.[ETL]
             WHERE Encounter_ID = @Encounter_ID`
        );
    return (result.recordset?.length || 0) > 0;
}

/**
 * Carry forward Narrative1 from row 5 onward (1-based), matching legacy SQL loop (skip first 4 rows).
 * @param {import("mssql").ConnectionPool} pool
 * @param {number} encounter_id
 */
async function applyTempPortalNarrativeCarryForward(pool, encounter_id) {
    const q = await pool
        .request()
        .input("Encounter_ID", sql.Int, encounter_id)
        .query(
            `SELECT PKey, Narrative1, Narrative2
             FROM ${DB}.[tempPortalAISource]
             WHERE Encounter_ID = @Encounter_ID
             ORDER BY PKey`
        );
    const rows = q.recordset || [];
    let hold1 = "";

    for (let i = 0; i < rows.length; i++) {
        const n1 =
            rows[i].Narrative1 == null
                ? ""
                : String(rows[i].Narrative1).trim();
        if (n1 !== "") {
            hold1 = rows[i].Narrative1;
        } else if (i >= 4 && hold1 !== "") {
            await pool
                .request()
                .input("PKey", sql.Int, rows[i].PKey)
                .input("Narrative1", sql.NVarChar(250), hold1)
                .query(
                    `UPDATE ${DB}.[tempPortalAISource]
                     SET Narrative1 = @Narrative1
                     WHERE PKey = @PKey`
                );
        }
    }

    await pool
        .request()
        .input("Encounter_ID", sql.Int, encounter_id)
        .query(
            `DELETE FROM ${DB}.[tempPortalAISource]
             WHERE Encounter_ID = @Encounter_ID AND (Narrative2 = '' OR Narrative2 IS NULL)`
        );
}

/**
 * Validate HRA + repopulate PortalAISource and tempPortalAISource for the patient's latest HRA encounter.
 * @returns {Promise<{ ok: true, encounterId: number } | { ok: false, code: string, message?: string }>}
 */
async function ensureHraTempPortalAISource(patient_id) {
    const encounterId = await getLatestHraEncounterId(patient_id);
    if (encounterId == null) {
        return {
            ok: false,
            code: "NO_HRA_ENCOUNTER",
            message: "No Health Risk Assessment encounter on file for this patient.",
        };
    }

    const hasEtl = await encounterHasEtl(encounterId);
    if (!hasEtl) {
        return {
            ok: false,
            code: "NO_ETL",
            message:
                "Health Risk Assessment encounter exists but ETL has no rows; assessment not completed.",
        };
    }

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        const base = (txt) =>
            new sql.Request(transaction).input("Encounter_ID", sql.Int, encounterId)
                .query(txt);

        await base(
            `DELETE FROM ${DB}.[PortalAISource] WHERE Encounter_ID = @Encounter_ID`
        );
        await base(
            `DELETE FROM ${DB}.[tempPortalAISource] WHERE Encounter_ID = @Encounter_ID`
        );

        const insVital = (
            narrative1,
            tml3MasterId
        ) =>
            new sql.Request(transaction)
                .input("Encounter_ID", sql.Int, encounterId)
                .input("N1", sql.NVarChar(250), narrative1)
                .input("TML3_TBotMaster_ID", sql.Int, tml3MasterId)
                .query(
                    `INSERT INTO ${DB}.[PortalAISource] (Encounter_ID, Narrative1, Narrative2)
                     SELECT @Encounter_ID, @N1, etl3i.ETL3Input
                     FROM ${DB}.[ETL3Input] etl3i
                     INNER JOIN ${DB}.[ETL3] etl3 ON etl3i.TML3_ID = etl3.TML3_ID
                     INNER JOIN ${DB_TEMPLATE}.[TML3] tml3 ON etl3i.TML3_ID = tml3.TML3_ID
                     WHERE etl3i.Encounter_ID = @Encounter_ID
                       AND etl3.Encounter_ID = @Encounter_ID
                       AND etl3i.ETL3Input IS NOT NULL
                       AND etl3i.ETL3Input <> 0
                       AND tml3.TML3_TBotMaster_ID = @TML3_TBotMaster_ID`
                );

        await insVital("What is the Weight in lbs:?", 424);
        await insVital("What is the Height in inches:?", 423);
        await insVital("What is the Systolic in inches of Hg:?", 425);
        await insVital("What is the Diastolic in inches of Hg:?", 426);

        await new sql.Request(transaction)
            .input("Encounter_ID", sql.Int, encounterId)
            .query(
                `INSERT INTO ${DB}.[PortalAISource] (Encounter_ID, Narrative1, Narrative2)
                 SELECT @Encounter_ID, tml3.TML3_Description, ''
                 FROM ${DB_TEMPLATE}.[TML3] tml3
                 WHERE tml3.TML3_ID IN (
                   SELECT etl3.TML3_ID FROM ${DB}.[ETL3] etl3
                   WHERE etl3.Encounter_ID = @Encounter_ID
                 )`
            );

        await base(
            `UPDATE ${DB}.[PortalAISource]
             SET Narrative2 = Narrative1
             WHERE Encounter_ID = @Encounter_ID AND (Narrative2 = '' OR Narrative2 IS NULL)`
        );
        await base(
            `UPDATE ${DB}.[PortalAISource]
             SET Narrative2 = ''
             WHERE Encounter_ID = @Encounter_ID AND Narrative2 LIKE '%?'`
        );
        await base(
            `UPDATE ${DB}.[PortalAISource]
             SET Narrative1 = ''
             WHERE Encounter_ID = @Encounter_ID
               AND Narrative1 = Narrative2`
        );
        await base(
            `DELETE FROM ${DB}.[PortalAISource]
             WHERE Encounter_ID = @Encounter_ID
               AND Narrative2 IN (
                 N'Weight (pounds)', N'[Input]', N'Height (inches)', N'Blood Pressure',
                 N'Systolic', N'Diastolic', N'---------------', N'style'
               )`
        );
        await base(
            `UPDATE ${DB}.[PortalAISource]
             SET Narrative1 = N'Find the 3 words you selected before, and select them again.',
                 Narrative2 = ''
             WHERE Encounter_ID = @Encounter_ID
               AND Narrative2 = N'Find the 3 words you selected before, and select them again.'`
        );

        await new sql.Request(transaction)
            .input("Encounter_ID", sql.Int, encounterId)
            .query(
                `INSERT INTO ${DB}.[tempPortalAISource]
                 (tempPortalAISource_ID, Encounter_ID, Narrative1, Narrative2, Hidden)
                 SELECT PortalAISource_ID, Encounter_ID, Narrative1, Narrative2, Hidden
                 FROM ${DB}.[PortalAISource]
                 WHERE Encounter_ID = @Encounter_ID
                 ORDER BY PortalAISource_ID`
            );

        await transaction.commit();
    } catch (err) {
        try {
            await transaction.rollback();
        } catch (rbErr) {
            console.warn("ensureHraTempPortalAISource rollback:", rbErr.message);
        }
        console.error("ensureHraTempPortalAISource:", err.message);
        return {
            ok: false,
            code: "DB_ERROR",
            message: err.message,
        };
    }

    try {
        await applyTempPortalNarrativeCarryForward(pool, encounterId);
    } catch (err) {
        console.error("applyTempPortalNarrativeCarryForward:", err.message);
        return { ok: false, code: "DB_ERROR", message: err.message };
    }

    return { ok: true, encounterId };
}

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
 * Rows from tempPortalAISource for the given encounter (preferred), else legacy: full table with optional patient column filter.
 */
const get_temp_portal_ai_source = async (patient_id, encounter_id) => {
    const pool = await getPool();
    try {
        let result;
        if (encounter_id != null && Number.isFinite(Number(encounter_id))) {
            result = await pool
                .request()
                .input("Encounter_ID", sql.Int, Number(encounter_id))
                .query(
                    `SELECT * FROM ${DB}.[tempPortalAISource]
                     WHERE Encounter_ID = @Encounter_ID
                     ORDER BY PKey`
                );
        } else {
            result = await pool.request().query(
                `SELECT * FROM ${DB}.[tempPortalAISource]`
            );
        }
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
    ensureHraTempPortalAISource,
};