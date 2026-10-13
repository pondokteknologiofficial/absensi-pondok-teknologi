/**
 * SKRIP MIGRASI DATA DARI SQLITE KE SUPABASE POSTGRESQL
 * Absensi Pondok Teknologi
 * 
 * Penggunaan:
 * node scripts/migrate_sqlite_to_supabase.js
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { Pool } = require('pg');
require('dotenv').config();

const config = require('../src/config');

async function runMigration() {
  console.log('===============================================================');
  console.log('  MIGRASI DATA ABSENSI PONDOK TEKNOLOGI (SQLITE -> SUPABASE)');
  console.log('===============================================================\n');

  // 1. Cek konfigurasi DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ [ERROR] DATABASE_URL tidak ditemukan di file .env!');
    console.error('   Silakan atur DATABASE_URL di file .env terlebih dahulu.');
    console.error('   Contoh:');
    console.error('   DATABASE_URL=postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres\n');
    process.exit(1);
  }

  // 2. Cek keberadaan file SQLite lokal
  const sqliteFile = config.DB_FILE;
  if (!fs.existsSync(sqliteFile)) {
    console.error(`❌ [ERROR] File SQLite lokal tidak ditemukan di: ${sqliteFile}`);
    process.exit(1);
  }

  console.log(`📂 Membaca database SQLite: ${sqliteFile}`);
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(sqliteFile);
  const sqliteDb = new SQL.Database(fileBuffer);

  // Helper untuk membaca semua baris dari SQLite
  function readSqliteTable(tableName) {
    const res = sqliteDb.exec(`SELECT * FROM ${tableName}`);
    if (!res || res.length === 0) return [];
    const columns = res[0].columns;
    return res[0].values.map(row => {
      const obj = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  }

  // 3. Baca data dari SQLite
  const persons = readSqliteTable('persons');
  const rules = readSqliteTable('attendance_rules');
  const prayerSchedules = readSqliteTable('prayer_schedules');
  const attendances = readSqliteTable('attendances');
  const users = readSqliteTable('users');
  const systemSettings = readSqliteTable('system_settings');

  console.log('📊 Rekap Data SQLite yang Ditemukan:');
  console.log(`   - persons           : ${persons.length} data`);
  console.log(`   - attendance_rules  : ${rules.length} data`);
  console.log(`   - prayer_schedules  : ${prayerSchedules.length} data`);
  console.log(`   - attendances       : ${attendances.length} data`);
  console.log(`   - users             : ${users.length} data`);
  console.log(`   - system_settings   : ${systemSettings.length} data\n`);

  // 4. Konek ke PostgreSQL Supabase
  console.log('🔌 Menghubungkan ke Supabase PostgreSQL...');
  const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocalhost ? false : { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('✅ Berhasil terhubung ke Supabase PostgreSQL!');

    // 5. Jalankan DDL Schema bila tabel belum ada
    console.log('🛠️  Memeriksa / membuat skema tabel di Supabase...');
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf-8');
    await client.query(schemaSql);
    console.log('✅ Skema tabel siap.\n');

    // 6. Mulai Transaksi Migrasi
    console.log('🚀 Memulai proses transfer data...');
    await client.query('BEGIN');

    // A. Migrasi persons
    console.log(`   -> Mengimpor ${persons.length} data persons...`);
    for (const p of persons) {
      await client.query(`
        INSERT INTO persons (id, nomor_induk, nama, tipe_person, jurusan, yayasan, qr_code, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (nomor_induk) DO UPDATE SET
          nama = EXCLUDED.nama,
          tipe_person = EXCLUDED.tipe_person,
          jurusan = EXCLUDED.jurusan,
          yayasan = EXCLUDED.yayasan,
          qr_code = EXCLUDED.qr_code,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
      `, [p.id, p.nomor_induk, p.nama, p.tipe_person, p.jurusan || '', p.yayasan || 'Pondok Teknologi', p.qr_code, p.status, p.created_at || new Date(), p.updated_at || new Date()]);
    }
    await client.query("SELECT setval(pg_get_serial_sequence('persons', 'id'), coalesce(max(id), 1), true) FROM persons");

    // B. Migrasi attendance_rules
    console.log(`   -> Mengimpor ${rules.length} data attendance_rules...`);
    for (const r of rules) {
      await client.query(`
        INSERT INTO attendance_rules (id, session_code, nama_absensi, jenis, start_scan, target_time, yellow_start, red_start, close_time, active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (session_code) DO UPDATE SET
          nama_absensi = EXCLUDED.nama_absensi,
          jenis = EXCLUDED.jenis,
          start_scan = EXCLUDED.start_scan,
          target_time = EXCLUDED.target_time,
          yellow_start = EXCLUDED.yellow_start,
          red_start = EXCLUDED.red_start,
          close_time = EXCLUDED.close_time,
          active = EXCLUDED.active,
          updated_at = EXCLUDED.updated_at
      `, [r.id, r.session_code, r.nama_absensi, r.jenis, r.start_scan, r.target_time, r.yellow_start, r.red_start, r.close_time, r.active, r.created_at || new Date(), r.updated_at || new Date()]);
    }
    await client.query("SELECT setval(pg_get_serial_sequence('attendance_rules', 'id'), coalesce(max(id), 1), true) FROM attendance_rules");

    // C. Migrasi prayer_schedules
    console.log(`   -> Mengimpor ${prayerSchedules.length} data prayer_schedules...`);
    for (const ps of prayerSchedules) {
      await client.query(`
        INSERT INTO prayer_schedules (id, tanggal, prayer_type, adhan_time, created_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tanggal, prayer_type) DO UPDATE SET
          adhan_time = EXCLUDED.adhan_time
      `, [ps.id, ps.tanggal, ps.prayer_type, ps.adhan_time, ps.created_at || new Date()]);
    }
    await client.query("SELECT setval(pg_get_serial_sequence('prayer_schedules', 'id'), coalesce(max(id), 1), true) FROM prayer_schedules");

    // D. Migrasi attendances
    console.log(`   -> Mengimpor ${attendances.length} data attendances...`);
    for (const a of attendances) {
      await client.query(`
        INSERT INTO attendances (id, person_id, session_code, nama_absensi, tanggal, waktu_scan, status, keterangan, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (person_id, session_code, tanggal) DO UPDATE SET
          waktu_scan = EXCLUDED.waktu_scan,
          status = EXCLUDED.status,
          keterangan = EXCLUDED.keterangan
      `, [a.id, a.person_id, a.session_code, a.nama_absensi, a.tanggal, a.waktu_scan, a.status, a.keterangan, a.created_at || new Date()]);
    }
    await client.query("SELECT setval(pg_get_serial_sequence('attendances', 'id'), coalesce(max(id), 1), true) FROM attendances");

    // E. Migrasi users
    console.log(`   -> Mengimpor ${users.length} data users...`);
    for (const u of users) {
      await client.query(`
        INSERT INTO users (id, username, password_hash, salt, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (username) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          salt = EXCLUDED.salt,
          role = EXCLUDED.role,
          updated_at = EXCLUDED.updated_at
      `, [u.id, u.username, u.password_hash, u.salt, u.role, u.created_at || new Date(), u.updated_at || new Date()]);
    }
    await client.query("SELECT setval(pg_get_serial_sequence('users', 'id'), coalesce(max(id), 1), true) FROM users");

    // F. Migrasi system_settings
    console.log(`   -> Mengimpor ${systemSettings.length} data system_settings...`);
    for (const s of systemSettings) {
      await client.query(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = EXCLUDED.updated_at
      `, [s.key, s.value, s.updated_at || new Date()]);
    }

    await client.query('COMMIT');
    console.log('✅ Seluruh data berhasil di-commit ke Supabase PostgreSQL!\n');

    // 7. Verifikasi Data Hasil Migrasi
    console.log('🔍 Memverifikasi data di Supabase PostgreSQL:');
    const pgPersons = await client.query('SELECT COUNT(*) as count FROM persons');
    const pgRules = await client.query('SELECT COUNT(*) as count FROM attendance_rules');
    const pgPrayer = await client.query('SELECT COUNT(*) as count FROM prayer_schedules');
    const pgAttendances = await client.query('SELECT COUNT(*) as count FROM attendances');
    const pgUsers = await client.query('SELECT COUNT(*) as count FROM users');
    const pgSettings = await client.query('SELECT COUNT(*) as count FROM system_settings');

    console.log(`   - persons           : ${pgPersons.rows[0].count} / ${persons.length} cocok`);
    console.log(`   - attendance_rules  : ${pgRules.rows[0].count} / ${rules.length} cocok`);
    console.log(`   - prayer_schedules  : ${pgPrayer.rows[0].count} / ${prayerSchedules.length} cocok`);
    console.log(`   - attendances       : ${pgAttendances.rows[0].count} / ${attendances.length} cocok`);
    console.log(`   - users             : ${pgUsers.rows[0].count} / ${users.length} cocok`);
    console.log(`   - system_settings   : ${pgSettings.rows[0].count} / ${systemSettings.length} cocok`);

    console.log('\n===============================================================');
    console.log('🎉 MIGRASI KE SUPABASE BERHASIL 100%!');
    console.log('   File SQLite lokal tetap tersimpan utuh di data/absensi.db');
    console.log('===============================================================\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [ERROR] Migrasi gagal dan telah di-rollback:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
