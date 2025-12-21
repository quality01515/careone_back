const sql = require("mssql");
const config = require("./database");
require("dotenv").config();

// Store the connection pool
let poolPromise = null;

/**
 * Get or create the database connection pool
 * @returns {Promise<ConnectionPool>} SQL Server connection pool
 */
async function getPool() {
  // If pool already exists and is connected, return it
  if (poolPromise) {
    try {
      const pool = await poolPromise;
      // Check if pool is still connected
      if (pool && pool.connected) {
        return pool;
      }
      // If not connected, remove it and create a new one
      poolPromise = null;
    } catch (err) {
      // If promise was rejected, remove it and create a new one
      poolPromise = null;
    }
  }

  // Create new pool
  poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
      if (config.debug) {
        console.log(`✅ Connected to SQL Server database: ${config.database}`);
        console.log(`   Server: ${config.server}:${config.port}`);
      }
      pool.on("error", err => {
        console.error("SQL pool error:", err);
        // Clear the pool on error to allow reconnection
        poolPromise = null;
      });
      return pool;
    })
    .catch(err => {
      poolPromise = null; // Clear failed pool
      console.error("❌ SQL connection failed:", err);
      throw err;
    });

  return poolPromise;
}

/**
 * Close the database connection pool
 * Useful for graceful shutdown
 */
async function closePool() {
  if (poolPromise) {
    try {
      const pool = await poolPromise;
      if (pool && pool.close) {
        await pool.close();
        if (config.debug) {
          console.log("Closed database connection pool");
        }
      }
    } catch (err) {
      console.error("Error closing pool:", err);
    } finally {
      poolPromise = null;
    }
  }
}

/**
 * Test database connection
 */
async function test() {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT SUSER_SNAME() AS login, DB_NAME() AS db");
    console.log("✅ CONNECTED:", result.recordset[0]);
  } catch (e) {
    console.error("❌ CONNECT FAILED:", e);
    throw e;
  }
}

// Export everything
module.exports = {
  sql,
  getPool,
  test,
  closePool,
};
