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
                    p.PortalComponentsDescription, 
                    p.ExternalLink,
                    ISNULL(ch.Hidden, 1) AS Hidden   -- default to 1 when no row exists
                FROM [Wellness_eCastEMR_Data].[dbo].[PortalCategories] c
                LEFT JOIN [Wellness_eCastEMR_Data].[dbo].[PortalComponents] p
                    ON p.PortalCategories_ID = c.PortalCategories_ID
                  AND ISNULL(p.Hidden, 0) = 0
                LEFT JOIN [Wellness_eCastEMR_Data].[dbo].[PortalComponentsChoices] ch
                    ON ch.PortalComponents_ID = p.PortalComponents_ID
                  AND ch.Patient_ID = @Patient_ID
                WHERE ISNULL(c.Hidden, 0) = 0
                ORDER BY c.SortOrder; 
            `);

    return result;
}

module.exports= {
    get_menus,  
}