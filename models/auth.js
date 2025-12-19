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

module.exports= {
    check_login,  
}