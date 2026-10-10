const assert = require('assert');
const http = require('http');

function postScan(qrCode, testTime, testDate) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      qr_code: qrCode,
      test_time: testTime,
      test_date: testDate
    });

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/scan',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function testDualScannerArchitecture() {
  console.log('=== MEMULAI TEST ARSITEKTUR DUAL SCANNER (CAMERA & USB SCANNER) ===\n');

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

  // Generate unique test date so test runs are completely idempotent
  const randDay = String(Math.floor(Math.random() * 25) + 1).padStart(2, '0');
  const randYear = 2070 + Math.floor(Math.random() * 20);
  const testDate = `${randYear}-10-${randDay}`;

  // 1. Simulasi Input dari Camera Scanner
  // Kamera membaca visual barcode -> menghasilkan string decodedText "QR-005" -> dikirim ke attendanceProcessor
  console.log('1. Simulasi Input Camera Scanner:');
  console.log('   Kamera membaca visual QR -> decodedText: "QR-005" (Haidar)');
  const cameraResult = await postScan('QR-005', '07:50:00', testDate);

  console.log('   Hasil Camera Scanner:', {
    status: cameraResult.status,
    label: cameraResult.label,
    person: cameraResult.person.nama,
    session: cameraResult.session.nama_absensi
  });

  assert.strictEqual(cameraResult.success, true, 'Camera scan should succeed');
  assert.strictEqual(cameraResult.status, 'PRESENT', 'Status should be PRESENT (Hijau)');
  assert.strictEqual(cameraResult.person.nomor_induk, 'PT005');
  assert.strictEqual(cameraResult.person.nama, 'Muhammad Haidar Rasyid');
  console.log('   ✅ [PASS] Camera Scanner berhasil memproses QR-005 sebagai HADIR (Hijau)\n');

  // 2. Simulasi Input dari USB QR Scanner (Keyboard Wedge)
  // Scanner kasir USB membaca barcode -> mengetik karakter "Q","R","-","0","0","6" lalu mengirim "Enter"
  // Ditangkap oleh scannerInput / keydown listener -> dikirim ke attendanceProcessor yang sama
  console.log('2. Simulasi Input USB QR Scanner (Keyboard Wedge):');
  console.log('   Scanner kasir mengirim karakter keyboard: "QR-006" + Enter (Razqa)');
  const usbResult = await postScan('QR-006', '07:50:00', testDate);

  console.log('   Hasil USB Scanner:', {
    status: usbResult.status,
    label: usbResult.label,
    person: usbResult.person.nama,
    session: usbResult.session.nama_absensi
  });

  assert.strictEqual(usbResult.success, true, 'USB scan should succeed');
  assert.strictEqual(usbResult.status, 'PRESENT', 'Status should be PRESENT (Hijau)');
  assert.strictEqual(usbResult.person.nomor_induk, 'PT006');
  assert.strictEqual(usbResult.person.nama, 'Razqa Nazarrahman');
  console.log('   ✅ [PASS] USB Scanner berhasil memproses QR-006 sebagai HADIR (Hijau)\n');

  // 3. Verifikasi Kesamaan Struktur dan Business Rules
  console.log('3. Verifikasi Konsistensi Arsitektur:');
  assert.strictEqual(cameraResult.code, usbResult.code, 'Both must produce same code ATTENDANCE_SUCCESS');
  assert.strictEqual(cameraResult.session.session_code, usbResult.session.session_code, 'Both must match same session MASUK_PAGI');
  assert.strictEqual(cameraResult.color, usbResult.color, 'Both must produce color green');
  console.log('   ✅ [PASS] Struktur respons dan aturan bisnis identik untuk kedua scanner!\n');

  // 4. Test Duplicate Scan pada Sesi yang Sama
  console.log('4. Test Duplicate Scan untuk Camera & USB:');
  const duplicateCamera = await postScan('QR-005', '07:55:00', testDate);
  const duplicateUsb = await postScan('QR-006', '07:55:00', testDate);

  assert.strictEqual(duplicateCamera.status, 'DUPLICATE', 'Camera duplicate must be rejected');
  assert.strictEqual(duplicateUsb.status, 'DUPLICATE', 'USB duplicate must be rejected');
  console.log('   ✅ [PASS] Keduanya mendeteksi scan duplikat dengan benar ("SUDAH ABSEN")\n');

  console.log('====================================================');
  console.log('SEMUA TEST INTEGRASI DUAL SCANNER BERHASIL (100% PASS)');
  console.log('====================================================\n');

  if (serverInstance) {
    if (serverInstance.closeAllConnections) serverInstance.closeAllConnections();
    serverInstance.close();
  }
  process.exit(0);
}

testDualScannerArchitecture().catch(err => {
  console.error('Test Error:', err);
  process.exit(1);
});
