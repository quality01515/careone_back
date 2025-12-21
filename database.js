/**
 * DATABASE CONFIGURATION
 * Configuration for Wellness_eCastEMR_Data database connection
 * Supports both local and production environments via environment variables
 */

require('dotenv').config();

// Get environment (local or production)
const NODE_ENV = process.env.NODE_ENV || 'development';

// Database connection settings from environment variables
// Use different variables for local vs production, or same variables with different values
const config = {
  user: process.env.DB_USER || process.env.APP_DB_USER || 'admin',
  password: process.env.DB_PASSWORD || process.env.APP_DB_PASSWORD || '',
  server: process.env.DB_SERVER || process.env.APP_DB_HOST?.split(',')[0] || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.APP_DB_HOST?.split(',')[1] || '1433'),
  database: 'Wellness_eCastEMR_Data',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true' || false, // Set to true for Azure SQL
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false', // true by default for local dev
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  debug: process.env.APP_DB_DEBUG === 'true' || NODE_ENV === 'development',
};

module.exports = config;
