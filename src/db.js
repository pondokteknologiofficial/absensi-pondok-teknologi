const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { Pool } = require('pg');
const config = require('./config');

let sqliteDb = null;
let SQL = null;
let pgPool = null;

// Helper: Ubah placeholder ? ke $1, $2, dst untuk PostgreSQL
function formatSqlForPg(sql) {
  let paramIndex = 1;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let converted = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'" && (i === 0 || sql[i - 1] !== '\\')) {
      inSingleQuote = !inSingleQuote;
      converted += char;
    } else if (char === '"' && (i === 0 || sql[i - 1] !== '\\')) {
      inDoubleQuote = !inDoubleQuote;
      converted += char;
    } else if (char === '?' && !inSingleQuote && !inDoubleQuote) {
      converted += `$${paramIndex++}`;
    } else {
      converted += char;
    }
  }

  // Kompatibilitas INSERT INTO system_settings (upsert)
  if (/INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+system_settings/i.test(converted)) {
    converted = converted
      .replace(/INSERT\s+OR\s+REPLACE\s+INTO\s+system_settings/i, 'INSERT INTO system_settings')
      .trim()
      .replace(/;?\s*$/, '') + ' ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at';
  }

  // Kompatibilitas fungsi waktu SQLite -> PostgreSQL
  converted = converted
    // 1. Perbandingan string leksikografis pada kolom varchar expires_at
    .replace(/s\.expires_at\s*>\s*datetime\s*\([^)]+\)/gi, "s.expires_at > TO_CHAR(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS')")
    // 2. Assignment kolom timestamp (updated_at, created_at)
    .replace(/(updated_at|created_at)\s*=\s*datetime\s*\([^)]+\)/gi, "$1 = (NOW() AT TIME ZONE 'Asia/Jakarta')")
    // 3. Nilai timestamp ekspresi mandiri
    .replace(/datetime\s*\(\s*'now'\s*,\s*'localtime'\s*\)/gi, "(NOW() AT TIME ZONE 'Asia/Jakarta')")
    .replace(/datetime\s*\(\s*([^,)]+)\s*\)/gi, "$1")
    .replace(/status\s*=\s*"AKTIF"/g, "status = 'AKTIF'")
    .replace(/status\s*=\s*"NONAKTIF"/g, "status = 'NONAKTIF'");

  return converted;
}

// Inisialisasi Database
async function initDb() {
  if (config.DB_TYPE === 'postgres') {
    if (!pgPool) {
      const isLocalhost = config.DATABASE_URL.includes('localhost') || config.DATABASE_URL.includes('127.0.0.1');
      pgPool = new Pool({
        connectionString: config.DATABASE_URL,
        ssl: isLocalhost ? false : { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      });

      // Uji koneksi awal
      const client = await pgPool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }
    }
    return pgPool;
  }

  // Default: SQLite via sql.js
  if (sqliteDb) return sqliteDb;

  if (!fs.existsSync(config.DB_DIR)) {
    fs.mkdirSync(config.DB_DIR, { recursive: true });
  }

  SQL = await initSqlJs();

  if (fs.existsSync(config.DB_FILE)) {
    const fileBuffer = fs.readFileSync(config.DB_FILE);
    sqliteDb = new SQL.Database(fileBuffer);
  } else {
    sqliteDb = new SQL.Database();
  }

  createSqliteTables();
  save();
  return sqliteDb;
}

function save() {
  if (config.DB_TYPE === 'postgres' || !sqliteDb) return;
  const data = sqliteDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.DB_FILE, buffer);
}

function createSqliteTables() {
  if (!sqliteDb) return;
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor_induk TEXT UNIQUE NOT NULL,
      nama TEXT NOT NULL,
      tipe_person TEXT NOT NULL,
      jurusan TEXT,
      qr_code TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'AKTIF',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS attendance_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_code TEXT UNIQUE NOT NULL,
      nama_absensi TEXT NOT NULL,
      jenis TEXT NOT NULL,
      start_scan TEXT NOT NULL,
      target_time TEXT NOT NULL,
      yellow_start TEXT NOT NULL,
      red_start TEXT NOT NULL,
      close_time TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS prayer_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL,
      prayer_type TEXT NOT NULL,
      adhan_time TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(tanggal, prayer_type)
    );

    CREATE TABLE IF NOT EXISTS attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      session_code TEXT NOT NULL,
      nama_absensi TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      waktu_scan TEXT NOT NULL,
      status TEXT NOT NULL,
      keterangan TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (person_id) REFERENCES persons(id),
      UNIQUE(person_id, session_code, tanggal)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'ADMIN',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_attendances_date ON attendances(tanggal);
    CREATE INDEX IF NOT EXISTS idx_attendances_person ON attendances(person_id);
    CREATE INDEX IF NOT EXISTS idx_persons_qr ON persons(qr_code);
    CREATE INDEX IF NOT EXISTS idx_prayer_date ON prayer_schedules(tanggal);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  `);
}

// Query multi-row
async function query(sql, params = []) {
  if (config.DB_TYPE === 'postgres') {
    if (!pgPool) await initDb();
    const pgSql = formatSqlForPg(sql);
    const res = await pgPool.query(pgSql, params);
    return res.rows;
  }

  // SQLite Mode
  if (!sqliteDb) await initDb();
  const stmt = sqliteDb.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Query single-row
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows && rows.length > 0 ? rows[0] : null;
}

// Run INSERT / UPDATE / DELETE
async function run(sql, params = []) {
  if (config.DB_TYPE === 'postgres') {
    if (!pgPool) await initDb();
    let pgSql = formatSqlForPg(sql).trim();

    const isInsert = /^INSERT\s+INTO/i.test(pgSql);
    const hasReturning = /RETURNING/i.test(pgSql);
    const hasNoIdTable = /INSERT\s+INTO\s+(sessions|system_settings)\b/i.test(pgSql);

    if (isInsert && !hasReturning && !hasNoIdTable) {
      pgSql += ' RETURNING id';
    }

    const res = await pgPool.query(pgSql, params);
    const lastId = (res.rows && res.rows[0] && res.rows[0].id) ? res.rows[0].id : 0;
    return {
      changes: res.rowCount || 0,
      lastInsertRowid: lastId
    };
  }

  // SQLite Mode
  if (!sqliteDb) await initDb();
  sqliteDb.run(sql, params);
  const infoRes = sqliteQuerySync('SELECT changes() as changes, last_insert_rowid() as lastInsertRowid');
  save();
  return {
    changes: infoRes[0] ? infoRes[0].changes : 0,
    lastInsertRowid: infoRes[0] ? infoRes[0].lastInsertRowid : 0
  };
}

// Synchronous query helper khusus internal SQLite save/lastid
function sqliteQuerySync(sql, params = []) {
  if (!sqliteDb) throw new Error('SQLite Database not initialized');
  const stmt = sqliteDb.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Synchronous queryOne helper khusus internal SQLite
function sqliteQueryOneSync(sql, params = []) {
  const rows = sqliteQuerySync(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Synchronous query helper (untuk backwards compatibility jika dipanggil sync di SQLite)
function querySync(sql, params = []) {
  return sqliteQuerySync(sql, params);
}

function queryOneSync(sql, params = []) {
  return sqliteQueryOneSync(sql, params);
}

// Execute batch SQL
async function exec(sql) {
  if (config.DB_TYPE === 'postgres') {
    if (!pgPool) await initDb();
    await pgPool.query(sql);
    return;
  }

  if (!sqliteDb) await initDb();
  sqliteDb.exec(sql);
  save();
}

function getDbBuffer() {
  if (!sqliteDb) throw new Error('SQLite database not initialized');
  return Buffer.from(sqliteDb.export());
}

async function close() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
}

async function checkHealth() {
  if (config.DB_TYPE === 'postgres') {
    if (!pgPool) await initDb();
    const res = await pgPool.query('SELECT 1 as ok');
    return { status: 'CONNECTED', type: 'Supabase PostgreSQL' };
  } else {
    if (!sqliteDb) await initDb();
    sqliteQuerySync('SELECT 1');
    return { status: 'CONNECTED', type: 'SQLite Lokal' };
  }
}

module.exports = {
  initDb,
  save,
  query,
  queryOne,
  querySync,
  queryOneSync,
  run,
  exec,
  getDbBuffer,
  close,
  formatSqlForPg,
  checkHealth
};

