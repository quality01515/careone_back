const sql = require('mssql');

const config = {
  user: 'admin',
  password: 'whitesnow',
  port: 1433,
  server: 'DESKTOP-B4SVKQ0', // e.g., 'localhost\\SQLEXPRESS'
  database: 'Wellness_eCastEMR_Data',
  options: {
    encrypt: false, // Set to true if using Azure, false for local SQL Server
    trustServerCertificate: true, // Add this line
    enableArithAbort: true,
  },
};

module.exports = config;