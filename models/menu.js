const { sql, getPool } = require("../db");

const get_menus = async () => {
    
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT 
        c.PortalCategories_ID, 
        c.PortalCategoriesName, 
        c.PortalCategoriesLongDescription, 
        c.PortalCategoriesDescription AS PortalCategoriesDescription, 
        p.PortalComponents_ID, 
        p.PortalComponentsName, 
        p.PortalComponentsDescription, 
        p.ExternalLink
      FROM [Wellness_eCastEMR_Data].[dbo].[PortalCategories] c
      LEFT JOIN [Wellness_eCastEMR_Data].[dbo].[PortalComponents] p ON p.PortalCategories_ID = c.PortalCategories_ID
      WHERE ISNULL(c.Hidden, 0) = 0  
        AND ISNULL(p.Hidden, 0) = 0 
      ORDER BY c.PortalCategoriesName, p.PortalComponentsName;
    `);

    return result;
}

module.exports= {
    get_menus,  
}