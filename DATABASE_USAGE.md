# Database Connection Guide

Simple database connection setup for **Wellness_eCastEMR_Data** database, supporting both local and production environments.

## Setup

Create a `.env` file in the `CareONE Journey API` directory with your database credentials.

### For Local Development

```env
# Local SQL Server Configuration
DB_USER=admin
DB_PASSWORD=whitesnow
DB_SERVER=DESKTOP-B4SVKQ0
DB_PORT=1433

# Optional: Enable debug logging
APP_DB_DEBUG=true
NODE_ENV=development
```

### For Production

```env
# Production SQL Server Configuration
DB_USER=WT1-SQL-Admin
DB_PASSWORD=W3llTr@ck1
DB_SERVER=192.168.137.10
DB_PORT=1433

# Optional: For Azure SQL, set encrypt to true
DB_ENCRYPT=true
DB_TRUST_CERT=false

# Optional: Disable debug logging
APP_DB_DEBUG=false
NODE_ENV=production
```

### Alternative: Using APP_DB_* variables (for compatibility)

You can also use the `APP_DB_*` variables that match your PHP project:

```env
APP_DB_HOST=192.168.137.10,1433  # Format: server,port
APP_DB_USER=WT1-SQL-Admin
APP_DB_PASSWORD=W3llTr@ck1
APP_DB_DEBUG=false
```

## Usage Examples

### Basic Usage (in Models)

```javascript
const { getPool, sql } = require('../db');

const getUsers = async () => {
  const pool = await getPool();
  const result = await pool.request()
    .query('SELECT * FROM [Wellness_eCastEMR_Data].[dbo].[PatientProfile]');
  return result.recordset;
};
```

### With Parameters

```javascript
const { getPool, sql } = require('../db');

const getUserById = async (patientId) => {
  const pool = await getPool();
  const result = await pool.request()
    .input('patient_id', sql.Int, patientId)
    .query('SELECT * FROM [Wellness_eCastEMR_Data].[dbo].[PatientProfile] WHERE Patient_ID = @patient_id');
  return result.recordset;
};
```

### Testing Connection

The connection is automatically tested when the server starts (in `app.js`). You can also test it manually:

```javascript
const { test } = require('./db');

// Test the database connection
test().then(() => {
  console.log('Database connection successful!');
}).catch(err => {
  console.error('Database connection failed:', err);
});
```

## Environment Variables Reference

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DB_USER` | Database username | `admin` | `WT1-SQL-Admin` |
| `DB_PASSWORD` | Database password | (empty) | `W3llTr@ck1` |
| `DB_SERVER` | Database server hostname | `localhost` | `192.168.137.10` |
| `DB_PORT` | Database server port | `1433` | `1433` |
| `DB_ENCRYPT` | Enable encryption (for Azure) | `false` | `true` |
| `DB_TRUST_CERT` | Trust server certificate | `true` | `false` |
| `APP_DB_DEBUG` | Enable debug logging | `false` | `true` |
| `NODE_ENV` | Environment mode | `development` | `production` |

**Alternative variables (for PHP compatibility):**
- `APP_DB_HOST` - Server and port (format: `server,port`)
- `APP_DB_USER` - Database username
- `APP_DB_PASSWORD` - Database password

## Notes

- The connection pool is automatically managed and reused
- Connections are created lazily (only when first accessed)
- The pool automatically reconnects on errors
- Use `.env` file for local development (make sure it's in `.gitignore`)
- Use environment variables directly on production servers

## Comparison with PHP

| PHP | Express.js |
|-----|------------|
| `$this->db->query(...)` | `await getPool()` then `pool.request().query(...)` |
| Environment variables in `env.php` | Environment variables in `.env` file |
| `[Wellness_eCastEMR_Data].[dbo].[Table]` | `[Wellness_eCastEMR_Data].[dbo].[Table]` (same) |
