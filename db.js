const sql = require("mssql");
require("dotenv").config();

const config = {
  user: process.env.DB_USER,              // e.g. WT1_SQL_Admin
  password: process.env.DB_PASSWORD,
  server: String(process.env.DB_SERVER || ""),         // e.g. DESKTOP-80CFN3P
  database: process.env.DB_NAME,          // e.g. MyDb
  options: {
    encrypt: false,                       // usually false for local SQL Server 2012
    trustServerCertificate: true,         // helpful for local/dev
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then(pool => {
        console.log("✅ Connected to SQL Server");
        pool.on("error", err => {
          console.error("SQL pool error:", err);
          // If you want auto-reconnect, set poolPromise = null here.
        });
        return pool;
      })
      .catch(err => {
        poolPromise = null; // important: allow retry next time
        console.error("❌ SQL connection failed:", err);
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { sql, getPool };
