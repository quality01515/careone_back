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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'withCredentials'],
  exposedHeaders: ['Set-Cookie']
}));

// Middleware to parse incoming requests with JSON payloads
app.use(express.json());

// Middleware to parse cookies
app.use(cookieParser());

// Health check endpoint (no authentication required)
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'CareONE Journey API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check endpoint at /health
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is healthy',
    timestamp: new Date().toISOString()
  });
});

// Use the insert/update routes
app.use('/api', menu_login);

// Error handling middleware (should be after all routes)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

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

// Log startup information
console.log('='.repeat(50));
console.log('Starting CareONE Journey API Server...');
console.log(`Port: ${PORT}`);
console.log(`Node Version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Working Directory: ${process.cwd()}`);
console.log('='.repeat(50));

// Start server with error handling
let server;
try {
  server = app.listen(PORT, () => {
    console.log(`✅ Server successfully started on port ${PORT}`);
    console.log(`✅ Server is listening for requests`);
  });

  server.on('error', (err) => {
    console.error('❌ Server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
    }
    process.exit(1);
  });

  // Test database connection (non-blocking)
  test().then(() => {
    console.log('✅ Database connection test passed');
  }).catch(err => {
    console.error('❌ Database connection test failed:', err);
    console.error('Server will continue running, but database operations may fail');
  });

} catch (error) {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  }
});

// Export app for testing or other uses
module.exports = app;
