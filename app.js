const express = require('express');
const menu_login = require('./routes/menu_login');
const { sql, getPool } = require("./db");
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

const allowedOrigins = ['http://localhost:3002', 'http://127.0.0.1:3002', 'http://localhost:3001', 'http://127.0.0.1:3001', 'https://careone-health.com', 'https://www.careone-health.com', 'http://127.0.0.1:3002'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow non-browser requests like Postman
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // If using cookies or session authentication
}));

// Middleware to parse incoming requests with JSON payloads
app.use(express.json());

// Middleware to parse cookies
app.use(cookieParser());


// Handling preflight requests
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie']
}));

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

// Call the test function before starting the server
app.listen(3001, () => console.log("Server running on port 3001"));
