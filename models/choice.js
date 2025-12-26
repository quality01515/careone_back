const { sql, getPool } = require("../db");

const update_choices = async (patient_id, components) => {
    
    const pool = await getPool();
    
    try {
      await pool.request()
      .input('Patient_ID', sql.Int, patient_id)
      .query('DELETE FROM [Wellness_eCastEMR_Data].[dbo].[PortalComponentsChoices] WHERE Patient_ID = @Patient_ID');

      console.log(`Deleted previous entries for Patient_ID: ${patient_id}`);
        
      const dateAdded = new Date(); 
          
      for (let component_id of components) {
          await pool.request()
              .input('Patient_ID', sql.Int, patient_id)
              .input('PortalComponents_ID', sql.Int, component_id)
              .input('DateAdded', sql.DateTime, dateAdded)
              .input('Hidden', sql.Bit, 0)
              .query('INSERT INTO [Wellness_eCastEMR_Data].[dbo].[PortalComponentsChoices] (Patient_ID, PortalComponents_ID, DateAdded, Hidden) VALUES (@Patient_ID, @PortalComponents_ID, @DateAdded, @Hidden)');

          console.log(`Inserted PortalComponent_ID: ${component_id} for Patient_ID: ${patient_id}`);
      }

      return {
        status: true
      };
    } catch (error) {
      console.error('SQL error', err);
      return {
        status: false,
        error
      };
    }
}

module.exports= {
    update_choices,  
}