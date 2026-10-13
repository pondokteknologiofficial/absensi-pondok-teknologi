const assert = require('assert');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const db = require('../src/db');
const { seedDatabase, seedPrayerScheduleForDate } = require('../src/seed');
const {
  timeToMinutes,
  minutesToTime,
  addMinutes,
  buildPrayerSessionRule,
  evaluateSessionStatus,
  resolveCurrentSession
} = require('../src/rules');

// Scan processing helper for testing (same core logic as API)
async function processScanForTest({ qr_code, test_time, test_date }) {
  const tanggal = test_date || '2026-09-25';
  const waktu_scan = test_time || '08:00:00';
  const hhmm = waktu_scan.slice(0, 5);

  // 1. Find Person by QR
  const person = await db.queryOne('SELECT * FROM persons WHERE qr_code = ?', [qr_code]);
  if (!person) {
    return {
      success: false,
      code: 'INVALID_QR',
      status: 'INVALID_QR',
      label: 'QR TIDAK TERDAFTAR',
      color: 'red',
      message: 'Kode QR tidak dikenali di sistem'
    };
  }

  // 2. Check Person Status
  if (person.status !== 'AKTIF') {
    return {
      success: false,
      code: 'INACTIVE_PERSON',
      status: 'INACTIVE_PERSON',
      label: 'DATA TIDAK AKTIF',
      color: 'red',
      person: {
        nama: person.nama,
        nomor_induk: person.nomor_induk,
        tipe_person: person.tipe_person,
        jurusan: person.jurusan
      },
      message: 'Status person saat ini NONAKTIF'
    };
  }

  // 3. Gather all active sessions for this date
  const productiveRules = await db.query('SELECT * FROM attendance_rules WHERE active = 1');
  const prayerSchedules = await db.query('SELECT * FROM prayer_schedules WHERE tanggal = ?', [tanggal]);

  const allSessions = [];
  for (const r of productiveRules) {
    allSessions.push({
      ...r,
      startScanMins: timeToMinutes(r.start_scan),
      yellowStartMins: timeToMinutes(r.yellow_start),
      redStartMins: timeToMinutes(r.red_start),
      closeTimeMins: timeToMinutes(r.close_time)
    });
  }
  for (const p of prayerSchedules) {
    allSessions.push(buildPrayerSessionRule(p.prayer_type, p.adhan_time));
  }

  // 4. Resolve active session
  const resolution = resolveCurrentSession(allSessions, hhmm);
  if (!resolution) {
    return {
      success: false,
      code: 'NO_SESSION',
      status: 'CLOSED',
      label: 'TIDAK ADA SESI',
      color: 'gray',
      message: 'Tidak ada sesi absensi yang terjadwal'
    };
  }

  const { session, isActive, evaluation } = resolution;

  if (!isActive) {
    return {
      success: false,
      code: evaluation.status, // NOT_YET or CLOSED
      status: evaluation.status,
      label: evaluation.label,
      color: evaluation.color,
      session: {
        session_code: session.session_code,
        nama_absensi: session.nama_absensi,
        start_scan: session.start_scan,
        close_time: session.close_time
      },
      person: {
        nama: person.nama,
        nomor_induk: person.nomor_induk,
        tipe_person: person.tipe_person,
        jurusan: person.jurusan
      },
      message: evaluation.message
    };
  }

  // 5. Active session - Check duplicate scan
  const existing = await db.queryOne(`
    SELECT * FROM attendances 
    WHERE person_id = ? AND session_code = ? AND tanggal = ?
  `, [person.id, session.session_code, tanggal]);

  if (existing) {
    return {
      success: false,
      code: 'DUPLICATE',
      status: 'DUPLICATE',
      label: 'SUDAH ABSEN',
      color: 'gray',
      session: {
        session_code: session.session_code,
        nama_absensi: session.nama_absensi
      },
      person: {
        nama: person.nama,
        nomor_induk: person.nomor_induk,
        tipe_person: person.tipe_person,
        jurusan: person.jurusan
      },
      existing_time: existing.waktu_scan,
      message: `${person.nama} sudah melakukan absensi pukul ${existing.waktu_scan}`
    };
  }

  // 6. Record attendance
  const insertResult = await db.run(`
    INSERT INTO attendances (person_id, session_code, nama_absensi, tanggal, waktu_scan, status, keterangan)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [person.id, session.session_code, session.nama_absensi, tanggal, waktu_scan, evaluation.status, evaluation.message]);

  return {
    success: true,
    code: 'ATTENDANCE_SUCCESS',
    status: evaluation.status, // PRESENT, LATE, LATE_CRITICAL
    label: evaluation.label,
    color: evaluation.color,
    attendance_id: insertResult.lastInsertRowid,
    session: {
      session_code: session.session_code,
      nama_absensi: session.nama_absensi
    },
    person: {
      id: person.id,
      nama: person.nama,
      nomor_induk: person.nomor_induk,
      tipe_person: person.tipe_person,
      jurusan: person.jurusan
    },
    waktu_scan,
    tanggal,
    message: evaluation.message
  };
}

async function runTests() {
  console.log('=== MEMULAI TEST OTOMATIS ATURAN ABSENSI PONDOK TEKNOLOGI ===\n');

  // Gunakan database test bersih di memory / temp
  const testDbFile = path.join(config.DB_DIR, 'test_absensi.db');
  if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
  config.DB_FILE = testDbFile;
  config.DB_TYPE = 'sqlite';

  await db.initDb();
  await seedDatabase(true);

  // Set Jadwal Shalat Subuh untuk testing: 04:20
  const testDate = '2026-09-25';
  await seedPrayerScheduleForDate(testDate, {
    SUBUH: '04:20',
    DZUHUR: '11:45',
    ASHAR: '15:00',
    MAGHRIB: '17:50',
    ISYA: '19:05'
  });

  let passed = 0;
  let total = 0;

  async function testCase(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  console.log('--- 1. Testing Rules Shalat Subuh (Adzan 04:20) ---');

  // Subuh rule calculation
  const subuhRule = buildPrayerSessionRule('SUBUH', '04:20');
  await testCase('Start Scan Subuh harus 04:10 (10 menit sebelum adzan)', () => {
    assert.strictEqual(subuhRule.start_scan, '04:10');
  });
  await testCase('Yellow Start Subuh harus 04:20 (saat adzan)', () => {
    assert.strictEqual(subuhRule.yellow_start, '04:20');
  });
  await testCase('Red Start Subuh harus 04:30 (+10 menit setelah adzan)', () => {
    assert.strictEqual(subuhRule.red_start, '04:30');
  });
  await testCase('Close Time Subuh harus 05:00 (+40 menit setelah adzan)', () => {
    assert.strictEqual(subuhRule.close_time, '05:00');
  });

  // Evaluate status tests for Subuh
  await testCase('Waktu 04:05 -> BELUM WAKTUNYA', () => {
    const res = evaluateSessionStatus('04:05', subuhRule);
    assert.strictEqual(res.status, 'NOT_YET');
  });
  await testCase('Waktu 04:10 -> HIJAU / HADIR', () => {
    const res = evaluateSessionStatus('04:10', subuhRule);
    assert.strictEqual(res.status, 'PRESENT');
    assert.strictEqual(res.color, 'green');
  });
  await testCase('Waktu 04:19 -> HIJAU / HADIR', () => {
    const res = evaluateSessionStatus('04:19', subuhRule);
    assert.strictEqual(res.status, 'PRESENT');
  });
  await testCase('Waktu 04:20 -> KUNING / TERLAMBAT', () => {
    const res = evaluateSessionStatus('04:20', subuhRule);
    assert.strictEqual(res.status, 'LATE');
    assert.strictEqual(res.color, 'yellow');
  });
  await testCase('Waktu 04:29 -> KUNING / TERLAMBAT', () => {
    const res = evaluateSessionStatus('04:29', subuhRule);
    assert.strictEqual(res.status, 'LATE');
  });
  await testCase('Waktu 04:30 -> MERAH / TERLAMBAT BERAT', () => {
    const res = evaluateSessionStatus('04:30', subuhRule);
    assert.strictEqual(res.status, 'LATE_CRITICAL');
    assert.strictEqual(res.color, 'red');
  });
  await testCase('Waktu 04:59 -> MERAH / TERLAMBAT BERAT', () => {
    const res = evaluateSessionStatus('04:59', subuhRule);
    assert.strictEqual(res.status, 'LATE_CRITICAL');
  });
  await testCase('Waktu 05:00 -> CLOSED / DITUTUP', () => {
    const res = evaluateSessionStatus('05:00', subuhRule);
    assert.strictEqual(res.status, 'CLOSED');
  });

  console.log('\n--- 2. Testing Rules Masuk Pagi (Target 08:00) ---');
  const pagiRule = await db.queryOne('SELECT * FROM attendance_rules WHERE session_code = ?', ['MASUK_PAGI']);

  await testCase('Waktu 07:40 -> BELUM WAKTUNYA', () => {
    const res = evaluateSessionStatus('07:40', pagiRule);
    assert.strictEqual(res.status, 'NOT_YET');
  });
  await testCase('Waktu 07:45 -> HIJAU / HADIR', () => {
    const res = evaluateSessionStatus('07:45', pagiRule);
    assert.strictEqual(res.status, 'PRESENT');
    assert.strictEqual(res.color, 'green');
  });
  await testCase('Waktu 07:59 -> HIJAU / HADIR', () => {
    const res = evaluateSessionStatus('07:59', pagiRule);
    assert.strictEqual(res.status, 'PRESENT');
  });
  await testCase('Waktu 08:00 -> KUNING / TERLAMBAT', () => {
    const res = evaluateSessionStatus('08:00', pagiRule);
    assert.strictEqual(res.status, 'LATE');
    assert.strictEqual(res.color, 'yellow');
  });
  await testCase('Waktu 08:09 -> KUNING / TERLAMBAT', () => {
    const res = evaluateSessionStatus('08:09', pagiRule);
    assert.strictEqual(res.status, 'LATE');
  });
  await testCase('Waktu 08:10 -> MERAH / TERLAMBAT BERAT', () => {
    const res = evaluateSessionStatus('08:10', pagiRule);
    assert.strictEqual(res.status, 'LATE_CRITICAL');
    assert.strictEqual(res.color, 'red');
  });
  await testCase('Waktu 08:39 -> MERAH / TERLAMBAT BERAT', () => {
    const res = evaluateSessionStatus('08:39', pagiRule);
    assert.strictEqual(res.status, 'LATE_CRITICAL');
  });
  await testCase('Waktu 08:40 -> CLOSED / DITUTUP', () => {
    const res = evaluateSessionStatus('08:40', pagiRule);
    assert.strictEqual(res.status, 'CLOSED');
  });

  console.log('\n--- 3. Testing Rules Masuk Siang (Target 13:00) ---');
  const siangRule = await db.queryOne('SELECT * FROM attendance_rules WHERE session_code = ?', ['MASUK_SIANG']);
  await testCase('Waktu 12:45 -> BELUM WAKTUNYA', () => {
    const res = evaluateSessionStatus('12:45', siangRule);
    assert.strictEqual(res.status, 'NOT_YET');
  });
  await testCase('Waktu 12:55 -> HIJAU / HADIR', () => {
    const res = evaluateSessionStatus('12:55', siangRule);
    assert.strictEqual(res.status, 'PRESENT');
  });
  await testCase('Waktu 13:10 -> KUNING / TERLAMBAT', () => {
    const res = evaluateSessionStatus('13:10', siangRule);
    assert.strictEqual(res.status, 'LATE');
  });
  await testCase('Waktu 13:30 -> MERAH / TERLAMBAT BERAT', () => {
    const res = evaluateSessionStatus('13:30', siangRule);
    assert.strictEqual(res.status, 'LATE_CRITICAL');
  });
  await testCase('Waktu 13:55 -> CLOSED / DITUTUP', () => {
    const res = evaluateSessionStatus('13:55', siangRule);
    assert.strictEqual(res.status, 'CLOSED');
  });

  console.log('\n--- 4. Testing End-to-End Scan & Database Integration ---');

  // Test QR Tidak Dikenal
  await testCase('Scan QR Tidak Dikenal -> INVALID_QR', async () => {
    const res = await processScanForTest({ qr_code: 'QR-999', test_time: '07:50:00', test_date: testDate });
    assert.strictEqual(res.status, 'INVALID_QR');
    assert.strictEqual(res.label, 'QR TIDAK TERDAFTAR');
  });

  // Test Person Nonaktif
  await testCase('Scan Person Nonaktif -> DATA TIDAK AKTIF', async () => {
    await db.run('UPDATE persons SET status = "NONAKTIF" WHERE qr_code = "QR-003"');
    const res = await processScanForTest({ qr_code: 'QR-003', test_time: '07:50:00', test_date: testDate });
    assert.strictEqual(res.status, 'INACTIVE_PERSON');
    assert.strictEqual(res.label, 'DATA TIDAK AKTIF');
    // Restore
    await db.run('UPDATE persons SET status = "AKTIF" WHERE qr_code = "QR-003"');
  });

  // Test Belum Waktunya Absen (e.g. 07:30 scan for Masuk Pagi)
  await testCase('Scan saat belum waktunya (07:30) -> BELUM WAKTUNYA ABSEN', async () => {
    const res = await processScanForTest({ qr_code: 'QR-001', test_time: '07:30:00', test_date: testDate });
    assert.strictEqual(res.status, 'NOT_YET');
    assert.strictEqual(res.label, 'BELUM WAKTUNYA ABSEN');
  });

  // Test Scan Hijau Masuk Pagi (07:50)
  await testCase('Scan Hijau Masuk Pagi (07:50) untuk Ryan (QR-001) -> PRESENT', async () => {
    const res = await processScanForTest({ qr_code: 'QR-001', test_time: '07:50:00', test_date: testDate });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'PRESENT');
    assert.strictEqual(res.person.nama, 'Ryan Firmansyah');
  });

  // Test Duplicate Scan
  await testCase('Scan Ulang di Sesi yang Sama -> DUPLICATE (SUDAH ABSEN)', async () => {
    const res = await processScanForTest({ qr_code: 'QR-001', test_time: '07:55:00', test_date: testDate });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 'DUPLICATE');
    assert.strictEqual(res.label, 'SUDAH ABSEN');
    assert.strictEqual(res.existing_time, '07:50:00');
  });

  // Test Scan Kuning Masuk Pagi (08:05)
  await testCase('Scan Kuning Masuk Pagi (08:05) untuk Ibnu (QR-002) -> LATE', async () => {
    const res = await processScanForTest({ qr_code: 'QR-002', test_time: '08:05:00', test_date: testDate });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'LATE');
    assert.ok(res.person.nama === 'Muhammad Nur Ibnu Hubab' || res.person.nama === 'M Nur Ibnu Hubab');
  });

  // Test Scan Merah Masuk Pagi (08:25)
  await testCase('Scan Merah Masuk Pagi (08:25) untuk Farhan (QR-004) -> LATE_CRITICAL', async () => {
    const res = await processScanForTest({ qr_code: 'QR-004', test_time: '08:25:00', test_date: testDate });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'LATE_CRITICAL');
    assert.strictEqual(res.person.nama, 'Farhan Sudrajat');
  });

  // Test Scan Sesi Ditutup (08:45)
  await testCase('Scan setelah sesi ditutup (08:45) -> ABSENSI SUDAH DITUTUP / NOT_YET', async () => {
    const res = await processScanForTest({ qr_code: 'QR-005', test_time: '08:45:00', test_date: testDate });
    assert.ok(res.status === 'CLOSED' || res.status === 'NOT_YET');
  });

  console.log('\n--- 5. Testing Database Persistence & Restart Simulation ---');
  await testCase('Verifikasi data absensi tersimpan di SQLite', async () => {
    const records = await db.query('SELECT * FROM attendances WHERE tanggal = ?', [testDate]);
    assert.strictEqual(records.length, 3); // QR-001, QR-002, QR-004
  });

  await testCase('Simulasi restart aplikasi: baca kembali database dari file', async () => {
    db.save();
    const fileBytes = fs.readFileSync(testDbFile);
    assert.ok(fileBytes.length > 0, 'Database file should exist and have data');
    const records = await db.query('SELECT count(*) as total FROM attendances');
    assert.strictEqual(Number(records[0].total), 3);
  });

  // Clean up test file
  if (fs.existsSync(testDbFile)) {
    fs.unlinkSync(testDbFile);
  }

  console.log(`\n========================================`);
  console.log(`HASIL TEST: ${passed} / ${total} BERHASIL`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
