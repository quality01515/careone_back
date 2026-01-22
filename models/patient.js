const { sql, getPool } = require("../db");

// Fetches a patient's profile information for report headers
const get_patient_profile = async (patient_id) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("patient_id", sql.Int, patient_id)
    .query(`
      SELECT TOP (1) *
      FROM [Wellness_eCastEMR_Data].[dbo].[PatientProfile]
      WHERE Patient_ID = @patient_id
    `);

  if (!result.recordset || result.recordset.length === 0) {
    return null;
  }
  return result.recordset[0];
};

// Fetches MRN, Provider name parts, and Practice in a single query
const get_patient_header_info = async (patient_id) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("patient_id", sql.Int, patient_id)
    .query(`
      SELECT TOP (1)
        p.MedicalRecordNumber AS MRN,
        pr.ProviderFirstName,
        pr.ProviderMiddleName,
        pr.ProviderLastName,
        pr.ProviderSuffix,
        o.OrgName AS Practice
      FROM [Wellness_eCastEMR_Data].[dbo].[PatientProfile] p
      LEFT JOIN [Wellness_eCastEMR_Data].[dbo].[ProviderProfile] pr ON pr.Provider_ID = p.Provider_ID
      LEFT JOIN [Wellness_eCastEMR_Data].[dbo].[OrgProfile] o ON o.Org_ID = p.Org_ID
      WHERE p.Patient_ID = @patient_id
    `);

  if (!result.recordset || result.recordset.length === 0) {
    return null;
  }
  return result.recordset[0];
};

module.exports = {
  get_patient_profile,
  get_patient_header_info,
};
