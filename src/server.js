const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const db = require('./db');
const { seedDatabase } = require('./seed');
const { requireAuth, validateSession } = require('./auth');
const apiRoutes = require('./routes/api');

const app = express();

// Path folder public (kompatibel lokal & Vercel serverless)
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, '..', 'public'))
  ? path.join(__dirname, '..', 'public')
  : path.join(process.cwd(), 'public');

// Disable x-powered-by header for security
app.disable('x-powered-by');

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Middlewares
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files (css, js, assets)
app.use(express.static(PUBLIC_DIR));

// Lazy initialization untuk serverless environment (Vercel) & local server
let isInitialized = false;
let initPromise = null;

async function ensureInitialized() {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await db.initDb();
        await seedDatabase(false);
      } catch (err) {
        console.error('Database initialization notice:', err.message);
      } finally {
        isInitialized = true;
      }
    })();
  }
  return initPromise;
}

// Middleware inisialisasi database sebelum memproses endpoint/rute
app.use(async (req, res, next) => {
  try {
    await ensureInitialized();
  } catch (err) {
    console.error('Error during lazy initialization:', err);
  }
  next();
});

// Health Check API (Production & Monitoring Endpoint)
// Mengembalikan status aplikasi & database tanpa membocorkan kredensial rahasia
app.get(['/api/health', '/health'], async (req, res) => {
  try {
    const dbHealth = await db.checkHealth();
    return res.json({
      status: 'UP',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: dbHealth,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    return res.status(503).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      database: { status: 'DISCONNECTED', error: 'Database connection failed' },
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

// Mount API routes
app.use('/api', apiRoutes);

// Public Routes - Scanner Kiosk (NO LOGIN REQUIRED)
app.get(['/', '/scan', '/scanner'], (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Login Page
app.get('/login', async (req, res) => {
  try {
    const token = req.cookies ? req.cookies.pt_session : null;
    const user = await validateSession(token);
    if (user) {
      return res.redirect('/admin/dashboard');
    }
    return res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
  } catch (err) {
    console.error('Error on /login page:', err);
    return res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
  }
});

// Protected Admin Routes (Require Login)
const adminRoutes = [
  '/admin',
  '/admin/dashboard',
  '/admin/persons',
  '/admin/productive-schedule',
  '/admin/prayer-schedule',
  '/admin/attendance-history',
  '/admin/backup'
];

app.get(adminRoutes, requireAuth, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

// Centralized Production Error Handler Middleware
// Menjamin tidak ada stack trace atau database connection string yang bocor ke user
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  if (res.headersSent) {
    return next(err);
  }

  const isProd = process.env.NODE_ENV === 'production';
  const isApi = (req.originalUrl && req.originalUrl.startsWith('/api/')) || 
                (req.headers.accept && req.headers.accept.includes('application/json'));

  if (isApi) {
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: isProd ? 'Terjadi kesalahan sistem internal pada server' : (err.message || 'Terjadi kesalahan sistem')
    });
  }

  return res.status(500).send('<h3>Terjadi kesalahan sistem internal pada server.</h3>');
});

// Initialize and start server
async function startServer() {
  try {
    const isPostgres = config.DB_TYPE === 'postgres';
    console.log(`Menginisialisasi Database (${isPostgres ? 'Supabase PostgreSQL' : 'SQLite Lokal'})...`);
    await ensureInitialized();

    // Bind ke 0.0.0.0 agar dapat diakses dari device lain di jaringan / internet
    const server = app.listen(config.PORT, '0.0.0.0', () => {
      console.log('==================================================');
      console.log('  SISTEM ABSENSI PONDOK TEKNOLOGI AKTIF');
      console.log('==================================================');
      console.log(`  Database Mode:         ${isPostgres ? 'SUPABASE POSTGRESQL' : 'SQLITE LOKAL'}`);
      console.log(`  Host:                  0.0.0.0 (Menerima koneksi multi-device)`);
      console.log(`  Port:                  ${config.PORT}`);
      console.log(`  Layar Scanner (Public): http://localhost:${config.PORT}/scanner`);
      console.log(`  Halaman Login:         http://localhost:${config.PORT}/login`);
      console.log(`  Panel Admin:           http://localhost:${config.PORT}/admin/dashboard`);
      console.log(`  Health Check:          http://localhost:${config.PORT}/api/health`);
      if (isPostgres) {
        console.log(`  Supabase URL:          ${config.SUPABASE_URL || 'Terkoneksi via DATABASE_URL'}`);
      } else {
        console.log(`  Database File:         ${config.DB_FILE}`);
      }
      console.log(`  Zona Waktu:            ${config.TIMEZONE}`);
      console.log('==================================================');
    });

    return server;
  } catch (err) {
    console.error('Gagal memulai server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

// Ekspor app secara langsung agar dikenali Vercel Serverless Function,
// dan sertakan startServer agar kompatibel dengan skrip testing
app.startServer = startServer;
module.exports = app;

