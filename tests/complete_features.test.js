const assert = require('assert');
const http = require('http');

function makeRequest({ method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: reqHeaders
    }, (res) => {
      let chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf-8');
        let parsed = null;
        try {
          parsed = JSON.parse(rawBody);
        } catch (e) {
          parsed = rawBody;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
          rawBuffer: Buffer.concat(chunks)
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runComprehensiveTests() {
  console.log('=== MEMULAI TEST LENGKAP SEMPURNAKAN SISTEM ABSENSI PONDOK TEKNOLOGI ===\n');
  let passed = 0;
  let total = 0;

  let serverInstance = null;
  try {
    await new Promise((resolve, reject) => {
      const check = http.get('http://localhost:3000/api/session/current', resolve);
      check.on('error', reject);
    });
  } catch (err) {
    const { startServer } = require('../src/server');
    serverInstance = await startServer();
  }

  // Generate unique test dates per test run so every execution is 100% idempotent
  const randDay1 = String(Math.floor(Math.random() * 25) + 1).padStart(2, '0');
  const randDay2 = String(Math.floor(Math.random() * 25) + 1).padStart(2, '0');
  const testYear = 2080 + Math.floor(Math.random() * 15);
  const testPrayerDate = `${testYear}-03-${randDay1}`;
  const prodTestDate = `${testYear}-04-${randDay2}`;

  function testAssert(desc, condition, details = '') {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}${details ? ': ' + JSON.stringify(details) : ''}`);
    }
  }

  // ----------------------------------------------------
  // TEST 1: AKSES SCANNER PUBLIC TANPA LOGIN
  // ----------------------------------------------------
  console.log('--- 1. Test Akses Scanner Public Tanpa Login ---');
  const resScanner = await makeRequest({ path: '/scanner' });
  testAssert('Akses /scanner harus HTTP 200 tanpa redirect', resScanner.statusCode === 200);

  const resRoot = await makeRequest({ path: '/' });
  testAssert('Akses / harus HTTP 200 tanpa redirect', resRoot.statusCode === 200);

  const resScanCurrent = await makeRequest({ path: '/api/session/current' });
  testAssert('API /api/session/current harus HTTP 200 (Public)', resScanCurrent.statusCode === 200);

  // ----------------------------------------------------
  // TEST 2: PROTEKSI AKSES ADMIN TANPA LOGIN
  // ----------------------------------------------------
  console.log('\n--- 2. Test Proteksi Admin Tanpa Login ---');
  const resAdminProtected = await makeRequest({ path: '/admin/dashboard' });
  testAssert('Akses /admin/dashboard tanpa login harus redirect (302) ke /login', 
    resAdminProtected.statusCode === 302 && resAdminProtected.headers.location === '/login');

  const resAdminBackup = await makeRequest({ path: '/admin/backup' });
  testAssert('Akses /admin/backup tanpa login harus redirect ke /login', 
    resAdminBackup.statusCode === 302 && resAdminBackup.headers.location === '/login');

  const resApiProtected = await makeRequest({ path: '/api/dashboard' });
  testAssert('Akses API /api/dashboard tanpa login harus HTTP 401 UNAUTHORIZED', 
    resApiProtected.statusCode === 401);

  // ----------------------------------------------------
  // TEST 3: SETUP FIRST ADMIN & LOGIN
  // ----------------------------------------------------
  console.log('\n--- 3. Test Setup Admin & Login ---');
  const authStatus1 = await makeRequest({ path: '/api/auth/status' });
  testAssert('API /api/auth/status dapat diakses publik', authStatus1.statusCode === 200);

  let sessionCookie = '';

  if (!authStatus1.body.has_admin) {
    console.log('   Belum ada admin, membuat admin pertama (setup)...');
    const setupRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/setup',
      body: { username: 'admin', password: 'admin123' }
    });
    testAssert('Setup admin pertama berhasil (HTTP 200)', setupRes.statusCode === 200 && setupRes.body.success === true);
    
    // Extract cookie
    const setCookie = setupRes.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      sessionCookie = setCookie[0].split(';')[0];
    }
  }

  // Test Password Salah
  console.log('   Menguji login dengan password salah...');
  const wrongPassRes = await makeRequest({
    method: 'POST',
    path: '/api/auth/login',
    body: { username: 'admin', password: 'password_salah' }
  });
  testAssert('Login dengan password salah harus ditolak (HTTP 401)', wrongPassRes.statusCode === 401);

  // Test Login Benar
  console.log('   Menguji login dengan kredensial benar...');
  const validLoginRes = await makeRequest({
    method: 'POST',
    path: '/api/auth/login',
    body: { username: 'admin', password: 'admin123' }
  });
  testAssert('Login berhasil dengan kredensial benar (HTTP 200)', validLoginRes.statusCode === 200 && validLoginRes.body.success === true);

  if (validLoginRes.headers['set-cookie']) {
    sessionCookie = validLoginRes.headers['set-cookie'][0].split(';')[0];
  }

  // ----------------------------------------------------
  // TEST 4: AKSES HALAMAN ADMIN DENGAN LOGIN
  // ----------------------------------------------------
  console.log('\n--- 4. Test Akses Admin Menggunakan Session Cookie ---');
  const authedHeader = { 'Cookie': sessionCookie };

  const resAuthedDashboard = await makeRequest({ path: '/admin/dashboard', headers: authedHeader });
  testAssert('Akses /admin/dashboard dengan session harus HTTP 200', resAuthedDashboard.statusCode === 200);

  const resAuthedPrayer = await makeRequest({ path: '/admin/prayer-schedule', headers: authedHeader });
  testAssert('Akses /admin/prayer-schedule dengan session harus HTTP 200', resAuthedPrayer.statusCode === 200);

  const resAuthedProd = await makeRequest({ path: '/admin/productive-schedule', headers: authedHeader });
  testAssert('Akses /admin/productive-schedule dengan session harus HTTP 200', resAuthedProd.statusCode === 200);

  const resAuthedBackup = await makeRequest({ path: '/admin/backup', headers: authedHeader });
  testAssert('Akses /admin/backup dengan session harus HTTP 200', resAuthedBackup.statusCode === 200);

  const resAuthedApiDash = await makeRequest({ path: '/api/dashboard', headers: authedHeader });
  testAssert('API /api/dashboard dengan session harus HTTP 200', resAuthedApiDash.statusCode === 200);

  // ----------------------------------------------------
  // TEST 5: JADWAL SHALAT (VALIDASI, EMPTY STATE, & ATURAN)
  // ----------------------------------------------------
  console.log('\n--- 5. Test Jadwal Shalat ---');
  // Tanggal yang belum diatur (testPrayerDate)

  // Check empty state
  const checkEmptyPrayer = await makeRequest({ path: `/api/prayer-schedules?date=${testPrayerDate}`, headers: authedHeader });
  testAssert('Tanggal belum diatur harus mengembalikan is_configured = false (Empty state jujur)', 
    checkEmptyPrayer.statusCode === 200 && checkEmptyPrayer.body.is_configured === false);

  // Test Validasi jam tidak masuk akal (Subuh setelah Dzuhur)
  const invalidOrderRes = await makeRequest({
    method: 'POST',
    path: '/api/prayer-schedules',
    headers: authedHeader,
    body: {
      tanggal: testPrayerDate,
      schedules: [
        { prayer_type: 'SUBUH', adhan_time: '12:00' },
        { prayer_type: 'DZUHUR', adhan_time: '11:45' },
        { prayer_type: 'ASHAR', adhan_time: '15:00' },
        { prayer_type: 'MAGHRIB', adhan_time: '17:45' },
        { prayer_type: 'ISYA', adhan_time: '18:55' }
      ]
    }
  });
  testAssert('Validasi jam shalat bertabrakan/terbalik harus ditolak (HTTP 400)', invalidOrderRes.statusCode === 400);

  // Simpan jadwal valid
  const savePrayerRes = await makeRequest({
    method: 'POST',
    path: '/api/prayer-schedules',
    headers: authedHeader,
    body: {
      tanggal: testPrayerDate,
      schedules: [
        { prayer_type: 'SUBUH', adhan_time: '04:20' },
        { prayer_type: 'DZUHUR', adhan_time: '11:45' },
        { prayer_type: 'ASHAR', adhan_time: '15:00' },
        { prayer_type: 'MAGHRIB', adhan_time: '17:45' },
        { prayer_type: 'ISYA', adhan_time: '18:55' }
      ]
    }
  });
  testAssert('Simpan jadwal shalat valid harus berhasil (HTTP 200)', savePrayerRes.statusCode === 200 && savePrayerRes.body.success === true);

  // Verifikasi aturan Subuh (04:20):
  // 04:05 -> NOT_YET
  const scanSubuhSebelum = await makeRequest({
    method: 'POST',
    path: '/api/scan',
    body: { qr_code: 'QR-001', test_time: '04:05:00', test_date: testPrayerDate }
  });
  testAssert('Subuh 04:05 -> BELUM WAKTUNYA (NOT_YET)', scanSubuhSebelum.body.status === 'NOT_YET');

  // 04:15 -> PRESENT (Hijau)
  const scanSubuhHijau = await makeRequest({
    method: 'POST',
    path: '/api/scan',
    body: { qr_code: 'QR-001', test_time: '04:15:00', test_date: testPrayerDate }
  });
  testAssert('Subuh 04:15 -> HIJAU (PRESENT)', scanSubuhHijau.body && scanSubuhHijau.body.status === 'PRESENT', scanSubuhHijau.body);

  // 04:25 -> LATE (Kuning)
  const scanSubuhKuning = await makeRequest({
    method: 'POST',
    path: '/api/scan',
    body: { qr_code: 'QR-002', test_time: '04:25:00', test_date: testPrayerDate }
  });
  testAssert('Subuh 04:25 -> KUNING (LATE)', scanSubuhKuning.body && scanSubuhKuning.body.status === 'LATE', scanSubuhKuning.body);

  // 04:45 -> LATE_CRITICAL (Merah)
  const scanSubuhMerah = await makeRequest({
    method: 'POST',
    path: '/api/scan',
    body: { qr_code: 'QR-003', test_time: '04:45:00', test_date: testPrayerDate }
  });
  testAssert('Subuh 04:45 -> MERAH (LATE_CRITICAL)', scanSubuhMerah.body && scanSubuhMerah.body.status === 'LATE_CRITICAL', scanSubuhMerah.body);

  // 05:05 -> CLOSED
  const scanSubuhTutup = await makeRequest({
    method: 'POST',
    path: '/api/scan',
    body: { qr_code: 'QR-004', test_time: '05:05:00', test_date: testPrayerDate }
  });
  testAssert('Subuh 05:05 -> DITUTUP (CLOSED / NOT_YET sesi berikutnya)', 
    scanSubuhTutup.body.status === 'CLOSED' || scanSubuhTutup.body.status === 'NOT_YET');

  // ----------------------------------------------------
  // TEST 6: JADWAL PRODUKTIF
  // ----------------------------------------------------
  console.log('\n--- 6. Test Jadwal Produktif ---');
  // Masuk Pagi (Target 08:00) pada test date baru (prodTestDate)

  // Sebelum 07:45 -> NOT_YET
  const scanPagiSebelum = await makeRequest({
    method: 'POST',
    path: '/api/scan',
    body: { qr_code: 'QR-001', test_time: '07:35:00', test_date: prodTestDate }
  });
  testAssert('Masuk Pagi 07:35 -> BELUM WAKTUNYA (NOT_YET)', scanPagiSebelum.body.status === 'NOT_YET');

  // 07:50 -> PRESENT (Hijau)
  const scanPagiHijau = await makeRequest({
    method: 'POST',
    path: '/api/scan',
    body: { qr_code: 'QR-001', test_time: '07:50:00', test_date: prodTestDate }
  });
  testAssert('Masuk Pagi 07:50 -> HIJAU (PRESENT)', scanPagiHijau.body && scanPagiHijau.body.status === 'PRESENT', scanPagiHijau.body);

  // Duplicate Scan
  const scanPagiDuplicate = await makeRequest({
    method: 'POST',
    path: '/api/scan',
    body: { qr_code: 'QR-001', test_time: '07:55:00', test_date: prodTestDate }
  });
  testAssert('Masuk Pagi scan kedua -> DUPLICATE (SUDAH ABSEN)', scanPagiDuplicate.body && scanPagiDuplicate.body.status === 'DUPLICATE', scanPagiDuplicate.body);

  // 08:05 -> LATE (Kuning)
  const scanPagiKuning = await makeRequest({
    method: 'POST',
    path: '/api/scan',
    body: { qr_code: 'QR-002', test_time: '08:05:00', test_date: prodTestDate }
  });
  testAssert('Masuk Pagi 08:05 -> KUNING (LATE)', scanPagiKuning.body && scanPagiKuning.body.status === 'LATE', scanPagiKuning.body);

  // 08:25 -> LATE_CRITICAL (Merah)
  const scanPagiMerah = await makeRequest({
    method: 'POST',
    path: '/api/scan',
    body: { qr_code: 'QR-003', test_time: '08:25:00', test_date: prodTestDate }
  });
  testAssert('Masuk Pagi 08:25 -> MERAH (LATE_CRITICAL)', scanPagiMerah.body && scanPagiMerah.body.status === 'LATE_CRITICAL', scanPagiMerah.body);

  // 08:45 -> CLOSED / NOT_YET
  const scanPagiTutup = await makeRequest({
    method: 'POST',
    path: '/api/scan',
    body: { qr_code: 'QR-004', test_time: '08:45:00', test_date: prodTestDate }
  });
  testAssert('Masuk Pagi 08:45 -> DITUTUP (CLOSED / NOT_YET)', 
    scanPagiTutup.body.status === 'CLOSED' || scanPagiTutup.body.status === 'NOT_YET');

  // QR Tidak Dikenal
  const scanInvalidQr = await makeRequest({
    method: 'POST',
    path: '/api/scan',
    body: { qr_code: 'QR-UNKNOWN-999', test_time: '07:50:00', test_date: prodTestDate }
  });
  testAssert('Scan QR tidak dikenal -> INVALID_QR', scanInvalidQr.body.status === 'INVALID_QR');

  // Person Nonaktif
  const toggleInactive = await makeRequest({
    method: 'PATCH',
    path: '/api/persons/4/toggle-status',
    headers: authedHeader
  });
  const scanInactive = await makeRequest({
    method: 'POST',
    path: '/api/scan',
    body: { qr_code: 'QR-004', test_time: '07:50:00', test_date: prodTestDate }
  });
  testAssert('Scan person nonaktif -> INACTIVE_PERSON (DATA TIDAK AKTIF)', scanInactive.body.status === 'INACTIVE_PERSON');
  // Kembalikan ke aktif
  await makeRequest({ method: 'PATCH', path: '/api/persons/4/toggle-status', headers: authedHeader });

  // ----------------------------------------------------
  // TEST 7: BACKUP SQLITE & CSV EXPORTS
  // ----------------------------------------------------
  console.log('\n--- 7. Test Backup Database & CSV Exports ---');
  const backupRes = await makeRequest({ path: '/api/system/backup', headers: authedHeader });
  testAssert('Download Backup Database HTTP 200', backupRes.statusCode === 200);
  
  const contentDisp = backupRes.headers['content-disposition'] || '';
  const isJsonBackup = (backupRes.headers['content-type'] || '').includes('json');

  if (isJsonBackup) {
    testAssert('Nama file backup berformat backup-absensi-YYYY-MM-DD-HHmmss.json', 
      /backup-absensi-\d{4}-\d{2}-\d{2}-\d{6}\.json/.test(contentDisp));
    testAssert('Format data backup adalah JSON valid yang berisi data tabel persons & attendances', 
      backupRes.body && backupRes.body.data && Array.isArray(backupRes.body.data.persons));
  } else {
    testAssert('Nama file backup berformat backup-absensi-YYYY-MM-DD-HHmmss.sqlite', 
      /backup-absensi-\d{4}-\d{2}-\d{2}-\d{6}\.sqlite/.test(contentDisp));
    const isSqliteHeader = backupRes.rawBuffer.slice(0, 15).toString() === 'SQLite format 3';
    testAssert('Header file backup adalah database SQLite yang valid ("SQLite format 3")', isSqliteHeader);
  }

  // Test CSV Absensi
  const csvAttRes = await makeRequest({ path: '/api/attendances/export/csv', headers: authedHeader });
  testAssert('Download Data Absensi CSV HTTP 200', csvAttRes.statusCode === 200);
  const csvAttText = csvAttRes.rawBuffer.toString('utf-8');
  testAssert('CSV Absensi mengandung header kolom lengkap (tanggal,nomor_induk,nama,tipe,jurusan,jenis_absensi,waktu_scan,status)',
    csvAttText.startsWith('tanggal,nomor_induk,nama,tipe,jurusan,jenis_absensi,waktu_scan,status'));

  // Test CSV Person
  const csvPersonRes = await makeRequest({ path: '/api/persons/export/csv', headers: authedHeader });
  testAssert('Download Data Person CSV HTTP 200', csvPersonRes.statusCode === 200);
  const csvPersonText = csvPersonRes.rawBuffer.toString('utf-8');
  testAssert('CSV Person mengandung header (nomor_induk,nama,tipe,jurusan,qr_code,status)',
    csvPersonText.startsWith('nomor_induk,nama,tipe,jurusan,qr_code,status'));

  // ----------------------------------------------------
  // TEST 8: LOGOUT
  // ----------------------------------------------------
  console.log('\n--- 8. Test Logout ---');
  const logoutRes = await makeRequest({
    method: 'POST',
    path: '/api/auth/logout',
    headers: authedHeader
  });
  testAssert('Logout HTTP 200', logoutRes.statusCode === 200);

  // Akses admin setelah logout
  const resAfterLogout = await makeRequest({ path: '/api/dashboard', headers: authedHeader });
  testAssert('Akses admin setelah logout harus ditolak (HTTP 401)', resAfterLogout.statusCode === 401);

  console.log(`\n====================================================`);
  console.log(`HASIL TEST INTEGRASI: ${passed} / ${total} BERHASIL`);
  console.log(`====================================================\n`);

  if (serverInstance) {
    if (serverInstance.closeAllConnections) serverInstance.closeAllConnections();
    serverInstance.close();
  }

  process.exit(passed === total ? 0 : 1);
}

runComprehensiveTests().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
