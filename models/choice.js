const { sql, getPool } = require("../db");

const update_choices = async (patient_id, components) => {
    
    const pool = await getPool();
    
    try {        
      const dateAdded = new Date(); 
          
      for (let component of components) {
        await pool.request()
            .input('Patient_ID', sql.Int, patient_id)
            .input('PortalComponents_ID', sql.Int, component.PortalComponents_ID)
            .input('DateAdded', sql.DateTime, dateAdded)
            .input('Hidden', sql.Bit, component.Hidden)
            .query(`
                MERGE [Wellness_eCastEMR_Data].[dbo].[PortalComponentsChoices] AS target
                USING (SELECT 
                          @Patient_ID AS Patient_ID, 
                          @PortalComponents_ID AS PortalComponents_ID
                      ) AS source
                ON target.Patient_ID = source.Patient_ID
                  AND target.PortalComponents_ID = source.PortalComponents_ID
                WHEN MATCHED THEN
                    UPDATE SET
                        DateAdded = @DateAdded,
                        Hidden = @Hidden
                WHEN NOT MATCHED THEN
                    INSERT (Patient_ID, PortalComponents_ID, DateAdded, Hidden)
                    VALUES (@Patient_ID, @PortalComponents_ID, @DateAdded, @Hidden);
            `);

        console.log(`Upserted PortalComponents_ID: ${component.PortalComponents_ID} for Patient_ID: ${patient_id}`);
      }

      return {
        status: true
      };
    } catch (error) {
      console.error('SQL error', error);
      return {
        status: false,
        error
      };
    }
}

module.exports= {
    update_choices,  
}