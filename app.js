const express = require('express');
const menu_login = require('./routes/menu_login');
const { sql, getPool,test } = require("./db");
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

const allowedOrigins = ['http://localhost:3002', 'http://127.0.0.1:3002', 'http://localhost:3001', 'http://127.0.0.1:3001', 'https://careone-health.com', 'https://www.careone-health.com', 'http://127.0.0.1:3002'];

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow non-browser requests like Postman
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
}));

// Middleware to parse incoming requests with JSON payloads
app.use(express.json());

// Middleware to parse cookies
app.use(cookieParser());

// Use the insert/update routes
app.use('/api', menu_login);

// Function to test the database connection
// const testDatabaseConnection = async () => {
//   try {
//     const pool = await getPool();
//     console.log('Database connection successful!');
//     await pool.close(); // Close the connection after testing
//   } catch (err) {
//     console.error('Database connection failed:', err);
//   }
// };

// Get port from environment variable (set by IIS) or use default
const PORT = process.env.PORT || process.env.HTTP_PLATFORM_PORT || 3001;

// Call the test function before starting the server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Test database connection
test().catch(err => {
  console.error('Database connection test failed:', err);
});

// Export app for testing or other uses
module.exports = app;
