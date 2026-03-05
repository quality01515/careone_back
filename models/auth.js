const { sql, getPool } = require("../db");

const check_login = async (last_name, formattedDob, phone_email) => {
    
    const pool = await getPool();
    const result = await pool.request()
        .input('last_name', sql.VarChar(150), last_name)  
        .input('dob', sql.Date, formattedDob)            
        .input('phone_email', sql.VarChar(150), phone_email)
        .query(`
        SELECT *
        FROM [Wellness_eCastEMR_Data].[dbo].[PatientProfile]
        WHERE LastName = @last_name 
            AND CAST(DOB AS DATE) = @dob  
            AND (
                PhoneCell = @phone_email 
                OR PhoneHome = @phone_email 
                OR PhoneWork = @phone_email 
                OR Email = @phone_email
            )
        `);

    return result;
}


const check_HRA_status = async (patient_id) => {
    
    const pool = await getPool();
    const result = await pool.request()
        .input("patient_id", sql.Int, patient_id)  
        .query(`
            SELECT TOP (1) AWACSDate, 
            DATEDIFF(DAY, AWACSDate, GETDATE()) AS DaysSince
            FROM [Wellness_eCastEMR_Data].[dbo].[EncounterHistory]
            WHERE Patient_ID = @patient_id AND AWACSStatus = 99
            ORDER BY AWACSDate DESC
        `);
    
    if (result.recordset.length === 0) {
      return ({
        patient_id,
        uncompleted: true,
        within30Days: false,
        lessThanYear: false,
      });
    }

    const { AWACSDate, DaysSince } = result.recordset[0];
    if (!AWACSDate) {
      return ({
        patient_id,
        uncompleted: true,
        within30Days: false,
        lessThanYear: false,
      });
    }

    console.log(AWACSDate, DaysSince);

    return ({
      patient_id,
      uncompleted: false,
      within30Days: DaysSince <= 30,
      lessThanYear: DaysSince <= 365 && DaysSince > 30,
    });
}

/**
 * Get the Encounter_ID for the patient's portal report.
 * Uses the same logic as the portal: ChiefComplaint + EncounterDescription = 'CareONE Visit [portal]',
 * order by Encounter_ID desc (same encounter as encounter_patient index and generate_report/ID).
 * @param {number} patient_id
 * @returns {Promise<number|null>} Encounter_ID or null if none
 */
const get_report_encounter_id = async (patient_id) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("patient_id", sql.Int, patient_id)
    .query(`
      SELECT TOP (1) eh.Encounter_ID
      FROM [Wellness_eCastEMR_Data].[dbo].[EncounterHistory] eh
      INNER JOIN [Wellness_eCastEMR_Data].[dbo].[Appointments] a ON a.Appointments_ID = eh.Appointments_ID
      WHERE eh.Patient_ID = @patient_id
        AND eh.ChiefComplaint = N'CareONE Visit [portal]'
        AND eh.EncounterDescription = N'CareONE Visit [portal]'
        AND (eh.Hidden = 0 OR eh.Hidden IS NULL)
        AND (a.Hidden = 0 OR a.Hidden IS NULL)
      ORDER BY eh.Encounter_ID DESC
    `);
  if (!result.recordset || result.recordset.length === 0) return null;
  return result.recordset[0].Encounter_ID;
};

module.exports = {
  check_login,
  check_HRA_status,
  get_report_encounter_id,
};