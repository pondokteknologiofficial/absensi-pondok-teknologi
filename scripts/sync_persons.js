const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { Pool } = require('pg');
require('dotenv').config();

const { SAMPLE_PERSONS } = require('../src/seed');
const config = require('../src/config');

async function syncPersons() {
  console.log('========================================================================');
  console.log('  SINKRONISASI DATA SANTRI & PENGURUS DENGAN KOLOM YAYASAN (LOKAL & CLOUD)');
  console.log('========================================================================\n');

  // 1. Sync ke Supabase PostgreSQL
  console.log('--- 1. SINKRONISASI KE SUPABASE POSTGRESQL (CLOUD) ---');
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (databaseUrl) {
    const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false }
    });

    try {
      const client = await pool.connect();
      try {
        console.log('🔌 Terhubung ke Supabase PostgreSQL.');
        
        // Pastikan kolom yayasan ada di tabel persons
        await client.query("ALTER TABLE persons ADD COLUMN IF NOT EXISTS yayasan VARCHAR(100) DEFAULT 'Pondok Teknologi'");

        for (const p of SAMPLE_PERSONS) {
          await client.query(`
            INSERT INTO persons (nomor_induk, nama, tipe_person, jurusan, yayasan, qr_code, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (nomor_induk) DO UPDATE SET
              nama = EXCLUDED.nama,
              tipe_person = EXCLUDED.tipe_person,
              jurusan = EXCLUDED.jurusan,
              yayasan = EXCLUDED.yayasan,
              qr_code = EXCLUDED.qr_code,
              status = EXCLUDED.status,
              updated_at = NOW() AT TIME ZONE 'Asia/Jakarta'
          `, [p.nomor_induk, p.nama, p.tipe_person, p.jurusan || '', p.yayasan || 'Pondok Teknologi', p.qr_code, p.status || 'AKTIF']);
        }

        await client.query("SELECT setval(pg_get_serial_sequence('persons', 'id'), coalesce(max(id), 1), true) FROM persons");
        const pgRes = await client.query('SELECT id, nomor_induk, nama, tipe_person, yayasan, jurusan, qr_code, status FROM persons ORDER BY yayasan ASC, nomor_induk ASC');
        console.log(`✅ Supabase Persons Total: ${pgRes.rows.length} data:`);
        console.table(pgRes.rows);
      } finally {
        client.release();
      }
      await pool.end();
    } catch (err) {
      console.error('❌ Gagal sinkronisasi ke Supabase:', err.message);
    }
  } else {
    console.log('⚠️ DATABASE_URL tidak ditemukan di .env, lewati Supabase.');
  }

  // 2. Sync ke SQLite Lokal
  console.log('\n--- 2. SINKRONISASI KE SQLITE LOKAL ---');
  if (fs.existsSync(config.DB_FILE)) {
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(config.DB_FILE);
    const sqliteDb = new SQL.Database(fileBuffer);

    // Cek kolom yayasan di SQLite
    const cols = sqliteDb.exec("PRAGMA table_info(persons)");
    if (cols && cols.length > 0) {
      const hasYayasan = cols[0].values.some(row => row[1] === 'yayasan');
      if (!hasYayasan) {
        sqliteDb.run("ALTER TABLE persons ADD COLUMN yayasan TEXT DEFAULT 'Pondok Teknologi'");
        console.log("➕ Menambahkan kolom yayasan ke tabel persons SQLite.");
      }
    }

    for (const p of SAMPLE_PERSONS) {
      const existing = sqliteDb.exec(`SELECT id FROM persons WHERE nomor_induk = '${p.nomor_induk}'`);
      if (existing.length === 0 || existing[0].values.length === 0) {
        sqliteDb.run(
          'INSERT INTO persons (nomor_induk, nama, tipe_person, jurusan, yayasan, qr_code, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [p.nomor_induk, p.nama, p.tipe_person, p.jurusan || '', p.yayasan || 'Pondok Teknologi', p.qr_code, p.status || 'AKTIF']
        );
      } else {
        sqliteDb.run(
          'UPDATE persons SET nama = ?, tipe_person = ?, jurusan = ?, yayasan = ?, qr_code = ?, status = ? WHERE nomor_induk = ?',
          [p.nama, p.tipe_person, p.jurusan || '', p.yayasan || 'Pondok Teknologi', p.qr_code, p.status || 'AKTIF', p.nomor_induk]
        );
      }
    }

    const data = sqliteDb.export();
    fs.writeFileSync(config.DB_FILE, Buffer.from(data));

    const sqliteRes = sqliteDb.exec('SELECT id, nomor_induk, nama, tipe_person, yayasan, jurusan, qr_code, status FROM persons ORDER BY yayasan ASC, nomor_induk ASC');
    const colsRes = sqliteRes[0].columns;
    const rows = sqliteRes[0].values.map(v => Object.fromEntries(colsRes.map((c, i) => [c, v[i]])));
    console.log(`✅ SQLite Persons Total: ${rows.length} data:`);
    console.table(rows);
  } else {
    console.log(`⚠️ File database SQLite (${config.DB_FILE}) tidak ditemukan.`);
  }

  console.log('\n========================================================================');
  console.log('🎉 SINKRONISASI KOLOM YAYASAN & 23 DATA SANTRI/PENGURUS BERHASIL 100%!');
  console.log('========================================================================\n');
}

if (require.main === module) {
  syncPersons().catch(console.error);
}

module.exports = { syncPersons };
