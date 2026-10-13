const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const db = require('../db');
const config = require('../config');
const {
  timeToMinutes,
  minutesToTime,
  getJakartaDate,
  getJakartaTime,
  getJakartaHHMM,
  buildPrayerSessionRule,
  evaluateSessionStatus,
  resolveCurrentSession
} = require('../rules');
const {
  hasAdminUser,
  createFirstAdmin,
  authenticate,
  createSession,
  validateSession,
  destroySession,
  requireAuth
} = require('../auth');
const { REGIONS, getPrayerTimesForDate } = require('../prayerService');

const router = express.Router();

// Helper: Get all sessions configured for a given date
// DOES NOT create fake prayer schedules if none exist in DB for that date
async function getSessionsForDate(dateStr) {
  // 1. Productive rules (Masuk Pagi, Masuk Siang)
  const productiveRules = await db.query('SELECT * FROM attendance_rules WHERE active = 1');
  const sessions = [];

  for (const r of productiveRules) {
    sessions.push({
      ...r,
      startScanMins: timeToMinutes(r.start_scan),
      yellowStartMins: timeToMinutes(r.yellow_start),
      redStartMins: timeToMinutes(r.red_start),
      closeTimeMins: timeToMinutes(r.close_time)
    });
  }

  // 2. Prayer schedules for this date (strictly only if configured in DB)
  const prayerSchedules = await db.query('SELECT * FROM prayer_schedules WHERE tanggal = ? ORDER BY id ASC', [dateStr]);

  if (prayerSchedules && prayerSchedules.length > 0) {
    for (const p of prayerSchedules) {
      sessions.push(buildPrayerSessionRule(p.prayer_type, p.adhan_time));
    }
  }

  return sessions;
}

// ==========================================
// 1. AUTHENTICATION & SESSION APIS (PUBLIC)
// ==========================================
router.get('/auth/status', async (req, res) => {
  try {
    const token = req.cookies ? req.cookies.pt_session : null;
    const user = await validateSession(token);
    const hasAdmin = await hasAdminUser();
    res.json({
      has_admin: hasAdmin,
      is_authenticated: !!user,
      user: user ? { id: user.id, username: user.username, role: user.role } : null
    });
  } catch (err) {
    console.error('auth/status error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan sistem' });
  }
});

router.post('/auth/setup', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hasAdmin = await hasAdminUser();
    if (hasAdmin) {
      return res.status(400).json({ success: false, error: 'Akun admin sudah dibuat sebelumnya' });
    }

    const admin = await createFirstAdmin(username, password);
    const session = await createSession(admin.id);

    const isHttps = Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');

    res.cookie('pt_session', session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, message: 'Akun admin berhasil dibuat', user: admin });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username dan password wajib diisi' });
    }

    const user = await authenticate(username, password);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Username atau password salah' });
    }

    const session = await createSession(user.id);
    const isHttps = Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');

    res.cookie('pt_session', session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, user });
  } catch (err) {
    console.error('auth/login error:', err);
    res.status(500).json({ success: false, error: 'Terjadi kesalahan saat login' });
  }
});

router.post('/auth/logout', async (req, res) => {
  try {
    const token = req.cookies ? req.cookies.pt_session : null;
    if (token) {
      await destroySession(token);
    }
    res.clearCookie('pt_session');
    res.json({ success: true });
  } catch (err) {
    console.error('auth/logout error:', err);
    res.status(500).json({ success: false, error: 'Gagal logout' });
  }
});

// ==========================================
// 2. SCAN API (PUBLIC - FOR SCANNER KIOSK)
// ==========================================
router.post('/scan', async (req, res) => {
  try {
    const { qr_code, test_time, test_date } = req.body;

    if (!qr_code || typeof qr_code !== 'string') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_INPUT',
        status: 'INVALID_QR',
        label: 'QR TIDAK TERDAFTAR',
        color: 'red',
        message: 'Kode QR wajib diisi'
      });
    }

    const trimmedQR = qr_code.trim();
    const currentDate = test_date || getJakartaDate();
    const currentTime = test_time || getJakartaTime();
    const currentHHMM = currentTime.slice(0, 5);

    // Step 1: Find person
    const person = await db.queryOne('SELECT * FROM persons WHERE qr_code = ?', [trimmedQR]);
    if (!person) {
      return res.json({
        success: false,
        code: 'INVALID_QR',
        status: 'INVALID_QR',
        label: 'QR TIDAK TERDAFTAR',
        color: 'red',
        scanned_code: trimmedQR,
        message: 'Kode QR tidak dikenali di sistem'
      });
    }

    // Step 2: Check active status
    if (person.status !== 'AKTIF') {
      return res.json({
        success: false,
        code: 'INACTIVE_PERSON',
        status: 'INACTIVE_PERSON',
        label: 'DATA TIDAK AKTIF',
        color: 'red',
        person: {
          id: person.id,
          nomor_induk: person.nomor_induk,
          nama: person.nama,
          tipe_person: person.tipe_person,
          jurusan: person.jurusan
        },
        message: 'Status person ini saat ini NONAKTIF'
      });
    }

    // Step 3: Get sessions and find active session
    const allSessions = await getSessionsForDate(currentDate);
    const resolution = resolveCurrentSession(allSessions, currentHHMM);

    if (!resolution) {
      return res.json({
        success: false,
        code: 'NO_SESSION',
        status: 'CLOSED',
        label: 'TIDAK ADA SESI',
        color: 'gray',
        message: 'Tidak ada jadwal sesi absensi'
      });
    }

    const { session, isActive, evaluation } = resolution;

    // Step 4: If not inside active window
    if (!isActive) {
      return res.json({
        success: false,
        code: evaluation.status,
        status: evaluation.status,
        label: evaluation.label,
        color: evaluation.color,
        person: {
          id: person.id,
          nomor_induk: person.nomor_induk,
          nama: person.nama,
          tipe_person: person.tipe_person,
          jurusan: person.jurusan
        },
        session: {
          session_code: session.session_code,
          nama_absensi: session.nama_absensi,
          start_scan: session.start_scan,
          close_time: session.close_time
        },
        message: evaluation.message
      });
    }

    // Step 5: Check duplicate scan
    const existing = await db.queryOne(`
      SELECT * FROM attendances 
      WHERE person_id = ? AND session_code = ? AND tanggal = ?
    `, [person.id, session.session_code, currentDate]);

    if (existing) {
      return res.json({
        success: false,
        code: 'DUPLICATE',
        status: 'DUPLICATE',
        label: 'SUDAH ABSEN',
        color: 'gray',
        person: {
          id: person.id,
          nomor_induk: person.nomor_induk,
          nama: person.nama,
          tipe_person: person.tipe_person,
          jurusan: person.jurusan
        },
        session: {
          session_code: session.session_code,
          nama_absensi: session.nama_absensi
        },
        existing_time: existing.waktu_scan,
        message: `${person.nama} sudah melakukan absensi pukul ${existing.waktu_scan}`
      });
    }

    // Step 6: Record attendance
    const insertRes = await db.run(`
      INSERT INTO attendances (person_id, session_code, nama_absensi, tanggal, waktu_scan, status, keterangan)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [person.id, session.session_code, session.nama_absensi, currentDate, currentTime, evaluation.status, evaluation.message]);

    return res.json({
      success: true,
      code: 'ATTENDANCE_SUCCESS',
      status: evaluation.status,
      label: evaluation.label,
      color: evaluation.color,
      attendance_id: insertRes.lastInsertRowid,
      person: {
        id: person.id,
        nomor_induk: person.nomor_induk,
        nama: person.nama,
        tipe_person: person.tipe_person,
        jurusan: person.jurusan
      },
      session: {
        session_code: session.session_code,
        nama_absensi: session.nama_absensi,
        jenis: session.jenis,
        start_scan: session.start_scan,
        close_time: session.close_time
      },
      waktu_scan: currentTime,
      tanggal: currentDate,
      message: evaluation.message
    });
  } catch (err) {
    console.error('Scan Error:', err);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      status: 'CLOSED',
      label: 'KESALAHAN SISTEM',
      color: 'red',
      message: 'Terjadi kesalahan sistem saat memproses scan'
    });
  }
});

// ==========================================
// 3. CURRENT SESSION (PUBLIC - FOR SCANNER)
// ==========================================
router.get('/session/current', async (req, res) => {
  try {
    const currentDate = getJakartaDate();
    const currentTime = getJakartaTime();
    const currentHHMM = currentTime.slice(0, 5);

    const allSessions = await getSessionsForDate(currentDate);
    const resolution = resolveCurrentSession(allSessions, currentHHMM);
    const countRow = await db.queryOne('SELECT COUNT(*) as cnt FROM prayer_schedules WHERE tanggal = ?', [currentDate]);

    res.json({
      current_date: currentDate,
      current_time: currentTime,
      current_hhmm: currentHHMM,
      has_prayer_schedule: countRow ? Number(countRow.cnt) > 0 : false,
      active_session: resolution && resolution.isActive ? resolution.session : null,
      evaluation: resolution ? resolution.evaluation : null,
      next_or_last_session: resolution ? resolution.session : null,
      all_sessions_today: allSessions.map(s => ({
        session_code: s.session_code,
        nama_absensi: s.nama_absensi,
        jenis: s.jenis,
        start_scan: s.start_scan,
        target_time: s.target_time,
        yellow_start: s.yellow_start,
        red_start: s.red_start,
        close_time: s.close_time
      }))
    });
  } catch (err) {
    console.error('session/current error:', err);
    res.status(500).json({ error: 'Gagal mengambil sesi aktif' });
  }
});

// =========================================================================
// PROTECTED ADMIN APIS (All routes below require authentication session)
// =========================================================================
router.use(requireAuth);

// ==========================================
// 4. DASHBOARD API
// ==========================================
router.get('/dashboard', async (req, res) => {
  try {
    const dateStr = req.query.date || getJakartaDate();

    // Total active persons
    const totalPersonsRes = await db.queryOne("SELECT COUNT(*) as total FROM persons WHERE status = 'AKTIF'");
    const totalSantriRes = await db.queryOne("SELECT COUNT(*) as total FROM persons WHERE status = 'AKTIF' AND tipe_person = 'SANTRI'");
    const totalPengurusRes = await db.queryOne("SELECT COUNT(*) as total FROM persons WHERE status = 'AKTIF' AND tipe_person = 'PENGURUS'");

    const totalActivePersons = totalPersonsRes ? Number(totalPersonsRes.total) : 0;
    const totalSantri = totalSantriRes ? Number(totalSantriRes.total) : 0;
    const totalPengurus = totalPengurusRes ? Number(totalPengurusRes.total) : 0;

    // Attendance counts for this date
    const statusCounts = await db.query(`
      SELECT status, COUNT(*) as count 
      FROM attendances 
      WHERE tanggal = ?
      GROUP BY status
    `, [dateStr]);

    const stats = {
      PRESENT: 0,
      LATE: 0,
      LATE_CRITICAL: 0,
      TOTAL_SCANS: 0
    };

    statusCounts.forEach(r => {
      const c = Number(r.count);
      if (stats[r.status] !== undefined) {
        stats[r.status] = c;
      }
      stats.TOTAL_SCANS += c;
    });

    // Rekap Santri vs Pengurus
    const roleBreakdown = await db.query(`
      SELECT p.tipe_person, a.status, COUNT(*) as count
      FROM attendances a
      JOIN persons p ON a.person_id = p.id
      WHERE a.tanggal = ?
      GROUP BY p.tipe_person, a.status
    `, [dateStr]);

    const santriStats = { PRESENT: 0, LATE: 0, LATE_CRITICAL: 0, TOTAL: 0 };
    const pengurusStats = { PRESENT: 0, LATE: 0, LATE_CRITICAL: 0, TOTAL: 0 };

    roleBreakdown.forEach(r => {
      const target = r.tipe_person === 'SANTRI' ? santriStats : pengurusStats;
      const c = Number(r.count);
      if (target[r.status] !== undefined) target[r.status] = c;
      target.TOTAL += c;
    });

    // Breakdown per Session
    const allSessions = await getSessionsForDate(dateStr);
    const sessionBreakdown = [];

    for (const s of allSessions) {
      const counts = await db.query(`
        SELECT status, COUNT(*) as count
        FROM attendances
        WHERE tanggal = ? AND session_code = ?
        GROUP BY status
      `, [dateStr, s.session_code]);

      const sStats = { PRESENT: 0, LATE: 0, LATE_CRITICAL: 0, TOTAL: 0 };
      counts.forEach(c => {
        const cnt = Number(c.count);
        if (sStats[c.status] !== undefined) sStats[c.status] = cnt;
        sStats.TOTAL += cnt;
      });

      const belumHadir = Math.max(0, totalActivePersons - sStats.TOTAL);

      sessionBreakdown.push({
        session_code: s.session_code,
        nama_absensi: s.nama_absensi,
        jenis: s.jenis,
        start_scan: s.start_scan,
        target_time: s.target_time,
        yellow_start: s.yellow_start,
        red_start: s.red_start,
        close_time: s.close_time,
        hadir: sStats.PRESENT,
        terlambat: sStats.LATE,
        terlambat_berat: sStats.LATE_CRITICAL,
        total_absen: sStats.TOTAL,
        belum_hadir: belumHadir
      });
    }

    // Recent 10 scans
    const recentScans = await db.query(`
      SELECT a.id, a.waktu_scan, a.nama_absensi, a.status, a.keterangan,
             p.nama, p.nomor_induk, p.tipe_person, p.jurusan
      FROM attendances a
      JOIN persons p ON a.person_id = p.id
      WHERE a.tanggal = ?
      ORDER BY a.waktu_scan DESC, a.id DESC
      LIMIT 10
    `, [dateStr]);

    res.json({
      date: dateStr,
      summary: {
        total_persons: totalActivePersons,
        total_santri: totalSantri,
        total_pengurus: totalPengurus,
        hadir: stats.PRESENT,
        terlambat: stats.LATE,
        terlambat_berat: stats.LATE_CRITICAL,
        total_scans: stats.TOTAL_SCANS
      },
      role_breakdown: {
        santri: santriStats,
        pengurus: pengurusStats
      },
      session_breakdown: sessionBreakdown,
      recent_scans: recentScans
    });
  } catch (err) {
    console.error('dashboard error:', err);
    res.status(500).json({ error: 'Gagal mengambil data dashboard' });
  }
});

// ==========================================
// 5. PERSONS CRUD & QR APIS
// ==========================================
router.get('/persons', async (req, res) => {
  try {
    const { search, tipe, status, yayasan, sort_by, sort_order } = req.query;
    let sql = 'SELECT * FROM persons WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (nama LIKE ? OR nomor_induk LIKE ? OR qr_code LIKE ? OR jurusan LIKE ? OR yayasan LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }
    if (tipe) {
      sql += ' AND tipe_person = ?';
      params.push(tipe);
    }
    if (yayasan) {
      sql += ' AND yayasan = ?';
      params.push(yayasan);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    const validCols = {
      nomor_induk: 'nomor_induk',
      nama: 'nama',
      tipe_person: 'tipe_person',
      yayasan: 'yayasan',
      jurusan: 'jurusan',
      qr_code: 'qr_code',
      status: 'status'
    };

    if (sort_by && validCols[sort_by]) {
      const dir = (sort_order && sort_order.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${validCols[sort_by]} ${dir}, id ASC`;
    } else {
      sql += ' ORDER BY tipe_person DESC, nomor_induk ASC';
    }

    const persons = await db.query(sql, params);
    res.json(persons);
  } catch (err) {
    console.error('persons list error:', err);
    res.status(500).json({ error: 'Gagal mengambil data person' });
  }
});

router.post('/persons', async (req, res) => {
  try {
    const { nomor_induk, nama, tipe_person, jurusan, yayasan, qr_code, status } = req.body;
    if (!nomor_induk || !nama || !tipe_person || !qr_code) {
      return res.status(400).json({ error: 'Nomor Induk, Nama, Kategori, dan Kode QR wajib diisi' });
    }

    const existing = await db.queryOne('SELECT id FROM persons WHERE nomor_induk = ? OR qr_code = ?', [nomor_induk.trim(), qr_code.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'Nomor Induk atau QR Code sudah terdaftar' });
    }

    const result = await db.run(`
      INSERT INTO persons (nomor_induk, nama, tipe_person, jurusan, yayasan, qr_code, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [nomor_induk.trim(), nama.trim(), tipe_person, jurusan ? jurusan.trim() : '', yayasan ? yayasan.trim() : 'Pondok Teknologi', qr_code.trim(), status || 'AKTIF']);

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('create person error:', err);
    res.status(500).json({ error: 'Gagal menyimpan person' });
  }
});

router.put('/persons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nomor_induk, nama, tipe_person, jurusan, yayasan, qr_code, status } = req.body;

    const existing = await db.queryOne('SELECT id FROM persons WHERE (nomor_induk = ? OR qr_code = ?) AND id != ?', [nomor_induk.trim(), qr_code.trim(), id]);
    if (existing) {
      return res.status(400).json({ error: 'Nomor Induk atau QR Code sudah digunakan oleh orang lain' });
    }

    await db.run(`
      UPDATE persons 
      SET nomor_induk = ?, nama = ?, tipe_person = ?, jurusan = ?, yayasan = ?, qr_code = ?, status = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [nomor_induk.trim(), nama.trim(), tipe_person, jurusan ? jurusan.trim() : '', yayasan ? yayasan.trim() : 'Pondok Teknologi', qr_code.trim(), status, id]);

    res.json({ success: true });
  } catch (err) {
    console.error('update person error:', err);
    res.status(500).json({ error: 'Gagal memperbarui person' });
  }
});

router.patch('/persons/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    const person = await db.queryOne('SELECT status FROM persons WHERE id = ?', [id]);
    if (!person) return res.status(404).json({ error: 'Data person tidak ditemukan' });

    const nextStatus = person.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF';
    await db.run(`
      UPDATE persons SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
    `, [nextStatus, id]);

    res.json({ success: true, status: nextStatus });
  } catch (err) {
    console.error('toggle status error:', err);
    res.status(500).json({ error: 'Gagal mengubah status person' });
  }
});

router.delete('/persons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const person = await db.queryOne('SELECT * FROM persons WHERE id = ?', [id]);
    if (!person) {
      return res.status(404).json({ error: 'Data santri/pengurus tidak ditemukan' });
    }

    // 1. Hapus semua riwayat absensi terkait person ini agar tidak melanggar foreign key constraint
    await db.run('DELETE FROM attendances WHERE person_id = ?', [id]);

    // 2. Hapus data person
    await db.run('DELETE FROM persons WHERE id = ?', [id]);

    db.save();

    res.json({
      success: true,
      message: `Data ${person.nama} (${person.nomor_induk}) berhasil dihapus!`
    });
  } catch (err) {
    console.error('delete person error:', err);
    res.status(500).json({ error: 'Gagal menghapus data person' });
  }
});

// Single QR Image
router.get('/persons/:id/qr', async (req, res) => {
  try {
    const person = await db.queryOne('SELECT * FROM persons WHERE id = ?', [req.params.id]);
    if (!person) return res.status(404).json({ error: 'Data person tidak ditemukan' });

    const qrDataUrl = await QRCode.toDataURL(person.qr_code, {
      width: 320,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' }
    });

    res.json({
      person,
      qr_code: person.qr_code,
      qr_image: qrDataUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal membuat gambar QR' });
  }
});

// Batch QR for printing all active ID cards
router.get('/persons-qr-all', async (req, res) => {
  try {
    const persons = await db.query("SELECT * FROM persons WHERE status = 'AKTIF' ORDER BY tipe_person DESC, nomor_induk ASC");
    const cards = [];

    for (const p of persons) {
      const qrDataUrl = await QRCode.toDataURL(p.qr_code, {
        width: 250,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
      cards.push({ ...p, qr_image: qrDataUrl });
    }

    res.json(cards);
  } catch (err) {
    res.status(500).json({ error: 'Gagal generate batch QR' });
  }
});

// ==========================================
// 6. ATTENDANCE RULES (PRODUKTIF)
// ==========================================
router.get('/rules', async (req, res) => {
  try {
    const rules = await db.query('SELECT * FROM attendance_rules ORDER BY id ASC');
    res.json(rules);
  } catch (err) {
    console.error('get rules error:', err);
    res.status(500).json({ error: 'Gagal mengambil aturan absensi' });
  }
});

router.put('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nama_absensi, start_scan, target_time, yellow_start, red_start, close_time, active } = req.body;

    // Validation
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(start_scan) || !timeRegex.test(target_time) ||
        !timeRegex.test(yellow_start) || !timeRegex.test(red_start) || !timeRegex.test(close_time)) {
      return res.status(400).json({ error: 'Format jam harus HH:mm (contoh: 08:00)' });
    }

    const mStart = timeToMinutes(start_scan);
    const mTarget = timeToMinutes(target_time);
    const mYellow = timeToMinutes(yellow_start);
    const mRed = timeToMinutes(red_start);
    const mClose = timeToMinutes(close_time);

    if (!(mStart <= mTarget && mTarget <= mYellow && mYellow < mRed && mRed < mClose)) {
      return res.status(400).json({
        error: 'Urutan jam tidak valid. Wajib memenuhi: Mulai Scan <= Target <= Batas Kuning < Batas Merah < Waktu Tutup'
      });
    }

    await db.run(`
      UPDATE attendance_rules
      SET nama_absensi = ?, start_scan = ?, target_time = ?, yellow_start = ?, red_start = ?, close_time = ?, active = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [nama_absensi.trim(), start_scan, target_time, yellow_start, red_start, close_time, active !== undefined ? active : 1, id]);

    res.json({ success: true, message: 'Jadwal produktif berhasil diperbarui' });
  } catch (err) {
    console.error('update rule error:', err);
    res.status(500).json({ error: 'Gagal memperbarui jadwal produktif' });
  }
});

// ==========================================
// 7. PRAYER SCHEDULES (SHALAT)
// ==========================================
router.get('/prayer-schedules', async (req, res) => {
  try {
    const dateStr = req.query.date || getJakartaDate();
    const schedules = await db.query('SELECT * FROM prayer_schedules WHERE tanggal = ? ORDER BY id ASC', [dateStr]);

    if (!schedules || schedules.length === 0) {
      return res.json({
        tanggal: dateStr,
        is_configured: false,
        message: 'Jadwal belum diatur untuk tanggal ini',
        schedules: []
      });
    }

    const augmented = schedules.map(p => {
      const rule = buildPrayerSessionRule(p.prayer_type, p.adhan_time);
      return {
        id: p.id,
        tanggal: p.tanggal,
        prayer_type: p.prayer_type,
        nama_absensi: rule.nama_absensi,
        adhan_time: p.adhan_time,
        start_scan: rule.start_scan,
        yellow_start: rule.yellow_start,
        red_start: rule.red_start,
        close_time: rule.close_time,
        green_window: `${rule.start_scan} - ${minutesToTime(timeToMinutes(rule.yellow_start) - 1)}`,
        yellow_window: `${rule.yellow_start} - ${minutesToTime(timeToMinutes(rule.red_start) - 1)}`,
        red_window: `${rule.red_start} - ${minutesToTime(timeToMinutes(rule.close_time) - 1)}`,
        close_window: `${rule.close_time} dst`
      };
    });

    res.json({
      tanggal: dateStr,
      is_configured: true,
      schedules: augmented
    });
  } catch (err) {
    console.error('prayer-schedules get error:', err);
    res.status(500).json({ error: 'Gagal mengambil jadwal shalat' });
  }
});

router.post('/prayer-schedules', async (req, res) => {
  try {
    const { tanggal, schedules } = req.body;
    if (!tanggal || !schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ error: 'Tanggal dan daftar jadwal shalat wajib diisi' });
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const requiredPrayers = ['SUBUH', 'DZUHUR', 'ASHAR', 'MAGHRIB', 'ISYA'];

    const prayerMap = {};
    for (const item of schedules) {
      if (!item.prayer_type || !item.adhan_time) {
        return res.status(400).json({ error: 'Setiap shalat harus memiliki prayer_type dan adhan_time' });
      }
      const typeUpper = item.prayer_type.toUpperCase();
      if (!timeRegex.test(item.adhan_time)) {
        return res.status(400).json({ error: `Format jam adzan ${typeUpper} tidak valid. Gunakan format HH:mm` });
      }
      prayerMap[typeUpper] = item.adhan_time;
    }

    for (const reqP of requiredPrayers) {
      if (!prayerMap[reqP]) {
        return res.status(400).json({ error: `Waktu adzan untuk ${reqP} wajib diisi` });
      }
    }

    const mSubuh = timeToMinutes(prayerMap['SUBUH']);
    const mDzuhur = timeToMinutes(prayerMap['DZUHUR']);
    const mAshar = timeToMinutes(prayerMap['ASHAR']);
    const mMaghrib = timeToMinutes(prayerMap['MAGHRIB']);
    const mIsya = timeToMinutes(prayerMap['ISYA']);

    if (!(mSubuh < mDzuhur && mDzuhur < mAshar && mAshar < mMaghrib && mMaghrib < mIsya)) {
      return res.status(400).json({
        error: 'Urutan waktu adzan tidak masuk akal! Waktu harus berurutan: Subuh < Dzuhur < Ashar < Maghrib < Isya'
      });
    }

    if ((mDzuhur - mSubuh < 180) || (mAshar - mDzuhur < 90) || (mMaghrib - mAshar < 90) || (mIsya - mMaghrib < 45)) {
      return res.status(400).json({
        error: 'Jarak antar waktu adzan terlalu dekat/bertabrakan secara tidak wajar.'
      });
    }

    const targetDates = [tanggal];
    if (req.body.copy_days && typeof req.body.copy_days === 'number' && req.body.copy_days > 0) {
      const daysToCopy = Math.min(req.body.copy_days, 30);
      const [y, m, d] = tanggal.split('-').map(Number);
      for (let i = 1; i <= daysToCopy; i++) {
        const dt = new Date(y, m - 1, d + i);
        const nextY = dt.getFullYear();
        const nextM = String(dt.getMonth() + 1).padStart(2, '0');
        const nextD = String(dt.getDate()).padStart(2, '0');
        targetDates.push(`${nextY}-${nextM}-${nextD}`);
      }
    }

    for (const tDate of targetDates) {
      for (const [prayer, adhan] of Object.entries(prayerMap)) {
        const existing = await db.queryOne('SELECT id FROM prayer_schedules WHERE tanggal = ? AND prayer_type = ?', [tDate, prayer]);
        if (existing) {
          await db.run('UPDATE prayer_schedules SET adhan_time = ? WHERE id = ?', [adhan, existing.id]);
        } else {
          await db.run('INSERT INTO prayer_schedules (tanggal, prayer_type, adhan_time) VALUES (?, ?, ?)', [tDate, prayer, adhan]);
        }
      }
    }

    res.json({
      success: true,
      message: targetDates.length > 1
        ? `Jadwal adzan berhasil disimpan untuk ${targetDates.length} hari berturut-turut!`
        : 'Jadwal adzan shalat berhasil disimpan'
    });
  } catch (err) {
    console.error('save prayer schedules error:', err);
    res.status(500).json({ error: 'Gagal menyimpan jadwal shalat' });
  }
});

router.post('/prayer-schedules/defaults', async (req, res) => {
  try {
    const { tanggal } = req.body;
    const dateStr = tanggal || getJakartaDate();

    const standardDefaults = {
      SUBUH: '04:20',
      DZUHUR: '11:45',
      ASHAR: '15:00',
      MAGHRIB: '17:45',
      ISYA: '18:55'
    };

    for (const [prayer, adhan] of Object.entries(standardDefaults)) {
      const existing = await db.queryOne('SELECT id FROM prayer_schedules WHERE tanggal = ? AND prayer_type = ?', [dateStr, prayer]);
      if (existing) {
        await db.run('UPDATE prayer_schedules SET adhan_time = ? WHERE id = ?', [adhan, existing.id]);
      } else {
        await db.run('INSERT INTO prayer_schedules (tanggal, prayer_type, adhan_time) VALUES (?, ?, ?)', [dateStr, prayer, adhan]);
      }
    }

    res.json({ success: true, message: 'Jadwal default berhasil diisi dan disimpan' });
  } catch (err) {
    console.error('default prayer schedule error:', err);
    res.status(500).json({ error: 'Gagal mengisi jadwal default' });
  }
});

// GET /api/prayer-schedules/regions - Daftar wilayah perhitungan Yogyakarta & sekitarnya
router.get('/prayer-schedules/regions', (req, res) => {
  res.json({
    success: true,
    regions: Object.values(REGIONS)
  });
});

// GET /api/prayer-schedules/calculate - Hitung waktu shalat dinamis Jogja (preview tanpa simpan)
router.get('/prayer-schedules/calculate', (req, res) => {
  try {
    const { tanggal, region } = req.query;
    const dateStr = tanggal || getJakartaDate();
    const result = getPrayerTimesForDate(dateStr, region || 'YOGYAKARTA');
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('calculate prayer error:', err);
    res.status(500).json({ error: 'Gagal menghitung waktu shalat' });
  }
});

// POST /api/prayer-schedules/sync-auto - Hitung dan simpan langsung ke database untuk 1 tanggal
router.post('/prayer-schedules/sync-auto', async (req, res) => {
  try {
    const { tanggal, region } = req.body;
    const dateStr = tanggal || getJakartaDate();
    const regionKey = region || 'YOGYAKARTA';
    const calc = getPrayerTimesForDate(dateStr, regionKey);

    const prayerMap = {
      SUBUH: calc.SUBUH,
      DZUHUR: calc.DZUHUR,
      ASHAR: calc.ASHAR,
      MAGHRIB: calc.MAGHRIB,
      ISYA: calc.ISYA
    };

    for (const [prayer, adhan] of Object.entries(prayerMap)) {
      const existing = await db.queryOne('SELECT id FROM prayer_schedules WHERE tanggal = ? AND prayer_type = ?', [dateStr, prayer]);
      if (existing) {
        await db.run('UPDATE prayer_schedules SET adhan_time = ? WHERE id = ?', [adhan, existing.id]);
      } else {
        await db.run('INSERT INTO prayer_schedules (tanggal, prayer_type, adhan_time) VALUES (?, ?, ?)', [dateStr, prayer, adhan]);
      }
    }

    db.save();

    res.json({
      success: true,
      message: `Jadwal shalat untuk ${calc.region} (${dateStr}) berhasil disinkronkan otomatis!`,
      schedules: calc
    });
  } catch (err) {
    console.error('sync-auto prayer error:', err);
    res.status(500).json({ error: 'Gagal menyinkronkan jadwal shalat otomatis' });
  }
});

// POST /api/prayer-schedules/sync-range - Generate otomatis jadwal shalat selama N hari (misal 30 hari ke depan)
router.post('/prayer-schedules/sync-range', async (req, res) => {
  try {
    const { start_date, days = 30, region } = req.body;
    const startDateStr = start_date || getJakartaDate();
    const totalDays = Math.min(Math.max(1, parseInt(days, 10) || 30), 365);
    const regionKey = region || 'YOGYAKARTA';

    const [y, m, d] = startDateStr.split('-').map(Number);

    for (let i = 0; i < totalDays; i++) {
      const dt = new Date(y, m - 1, d + i);
      const curY = dt.getFullYear();
      const curM = String(dt.getMonth() + 1).padStart(2, '0');
      const curD = String(dt.getDate()).padStart(2, '0');
      const curDateStr = `${curY}-${curM}-${curD}`;

      const calc = getPrayerTimesForDate(curDateStr, regionKey);
      const prayerMap = {
        SUBUH: calc.SUBUH,
        DZUHUR: calc.DZUHUR,
        ASHAR: calc.ASHAR,
        MAGHRIB: calc.MAGHRIB,
        ISYA: calc.ISYA
      };

      for (const [prayer, adhan] of Object.entries(prayerMap)) {
        const existing = await db.queryOne('SELECT id FROM prayer_schedules WHERE tanggal = ? AND prayer_type = ?', [curDateStr, prayer]);
        if (existing) {
          await db.run('UPDATE prayer_schedules SET adhan_time = ? WHERE id = ?', [adhan, existing.id]);
        } else {
          await db.run('INSERT INTO prayer_schedules (tanggal, prayer_type, adhan_time) VALUES (?, ?, ?)', [curDateStr, prayer, adhan]);
        }
      }
    }

    db.save();

    res.json({
      success: true,
      message: `Berhasil men-generate jadwal shalat otomatis untuk ${totalDays} hari ke depan (Wilayah: ${REGIONS[regionKey]?.nama || 'Yogyakarta'})!`
    });
  } catch (err) {
    console.error('sync-range prayer error:', err);
    res.status(500).json({ error: 'Gagal membuat jadwal shalat otomatis' });
  }
});


// ==========================================
// 8. ATTENDANCES (RIWAYAT ABSENSI)
// ==========================================
router.get('/attendances', async (req, res) => {
  try {
    const { tanggal, nama, tipe_person, session_code, status, sort_by, sort_order, limit = 500 } = req.query;

    let sql = `
      SELECT a.id, a.tanggal, a.waktu_scan, a.session_code, a.nama_absensi, a.status, a.keterangan, a.created_at,
             p.id as person_id, p.nama, p.nomor_induk, p.tipe_person, p.jurusan, p.yayasan, p.qr_code
      FROM attendances a
      JOIN persons p ON a.person_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (tanggal) {
      sql += ' AND a.tanggal = ?';
      params.push(tanggal);
    }
    if (nama) {
      sql += ' AND (p.nama LIKE ? OR p.nomor_induk LIKE ?)';
      const term = `%${nama.trim()}%`;
      params.push(term, term);
    }
    if (tipe_person) {
      sql += ' AND p.tipe_person = ?';
      params.push(tipe_person);
    }
    if (session_code) {
      sql += ' AND a.session_code = ?';
      params.push(session_code);
    }
    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }

    const validAttendanceCols = {
      tanggal: 'a.tanggal',
      waktu_scan: 'a.waktu_scan',
      nama: 'p.nama',
      nomor_induk: 'p.nomor_induk',
      tipe_person: 'p.tipe_person',
      session_code: 'a.session_code',
      nama_absensi: 'a.nama_absensi',
      status: 'a.status'
    };

    if (sort_by && validAttendanceCols[sort_by]) {
      const dir = (sort_order && sort_order.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
      sql += ` ORDER BY ${validAttendanceCols[sort_by]} ${dir}, a.id DESC LIMIT ?`;
    } else {
      sql += ' ORDER BY a.tanggal DESC, a.waktu_scan DESC, a.id DESC LIMIT ?';
    }
    params.push(Number(limit));

    const rows = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('attendances query error:', err);
    res.status(500).json({ error: 'Gagal mengambil catatan absensi' });
  }
});

router.delete('/attendances/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM attendances WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Catatan absensi berhasil dihapus' });
  } catch (err) {
    console.error('delete attendance error:', err);
    res.status(500).json({ error: 'Gagal menghapus absensi' });
  }
});

// ==========================================
// 9. BACKUP & CSV EXPORT
// ==========================================
// Download database snapshot
router.get('/system/backup', async (req, res) => {
  try {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const ss = pad(now.getSeconds());

    const timestampStr = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    await db.run(`
      INSERT OR REPLACE INTO system_settings (key, value, updated_at)
      VALUES ('last_backup_time', ?, datetime('now', 'localtime'))
    `, [timestampStr]);

    if (config.DB_TYPE === 'postgres') {
      // Postgres Mode: Export JSON snapshot of all tables
      const persons = await db.query('SELECT * FROM persons ORDER BY id ASC');
      const rules = await db.query('SELECT * FROM attendance_rules ORDER BY id ASC');
      const prayerSchedules = await db.query('SELECT * FROM prayer_schedules ORDER BY id ASC');
      const attendances = await db.query('SELECT * FROM attendances ORDER BY id ASC');
      const users = await db.query('SELECT id, username, password_hash, salt, role, created_at, updated_at FROM users ORDER BY id ASC');
      const settings = await db.query('SELECT * FROM system_settings');

      const backupObj = {
        meta: {
          app: 'Absensi Pondok Teknologi',
          version: '1.0.0',
          engine: 'Supabase PostgreSQL',
          backup_time: timestampStr
        },
        data: {
          persons,
          attendance_rules: rules,
          prayer_schedules: prayerSchedules,
          attendances,
          users,
          system_settings: settings
        }
      };

      const filename = `backup-absensi-${yyyy}-${mm}-${dd}-${hh}${min}${ss}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(JSON.stringify(backupObj, null, 2), 'utf-8'));
    }

    // SQLite Mode: Download binary SQLite file
    const buffer = db.getDbBuffer();
    const filename = `backup-absensi-${yyyy}-${mm}-${dd}-${hh}${min}${ss}.sqlite`;
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Gagal membuat file backup' });
  }
});

// System Info
router.get('/system/info', async (req, res) => {
  try {
    const personCount = await db.queryOne('SELECT COUNT(*) as count FROM persons');
    const activePersonCount = await db.queryOne("SELECT COUNT(*) as count FROM persons WHERE status = 'AKTIF'");
    const attendanceCount = await db.queryOne('SELECT COUNT(*) as count FROM attendances');
    const lastBackupSetting = await db.queryOne("SELECT value FROM system_settings WHERE key = 'last_backup_time'");

    let dbSize = 0;
    if (config.DB_TYPE === 'postgres') {
      try {
        const sizeRes = await db.queryOne("SELECT pg_database_size(current_database()) as size");
        dbSize = sizeRes ? Number(sizeRes.size) : 0;
      } catch (e) {
        dbSize = 0;
      }
    } else if (fs.existsSync(config.DB_FILE)) {
      const stats = fs.statSync(config.DB_FILE);
      dbSize = stats.size;
    }

    const formatBytes = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      else return (bytes / 1048576).toFixed(2) + ' MB';
    };

    res.json({
      status: 'ONLINE',
      database_type: config.DB_TYPE === 'postgres' ? 'Supabase PostgreSQL' : 'SQLite Lokal',
      timezone: config.TIMEZONE,
      server_time: getJakartaTime(),
      server_date: getJakartaDate(),
      total_persons: personCount ? Number(personCount.count) : 0,
      total_active_persons: activePersonCount ? Number(activePersonCount.count) : 0,
      total_attendances: attendanceCount ? Number(attendanceCount.count) : 0,
      db_size_bytes: dbSize,
      db_size_formatted: formatBytes(dbSize),
      last_backup: lastBackupSetting ? lastBackupSetting.value : null
    });
  } catch (err) {
    console.error('system/info error:', err);
    res.status(500).json({ error: 'Gagal mengambil informasi sistem' });
  }
});

// Download Data Absensi CSV
router.get('/attendances/export/csv', async (req, res) => {
  try {
    const { tanggal, session_code } = req.query;
    let sql = `
      SELECT a.tanggal, p.nomor_induk, p.nama, p.tipe_person as tipe, p.jurusan, p.yayasan,
             a.nama_absensi as jenis_absensi, a.waktu_scan, a.status
      FROM attendances a
      JOIN persons p ON a.person_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (tanggal) {
      sql += ' AND a.tanggal = ?';
      params.push(tanggal);
    }
    if (session_code) {
      sql += ' AND a.session_code = ?';
      params.push(session_code);
    }
    sql += ' ORDER BY a.tanggal DESC, a.waktu_scan DESC';

    const rows = await db.query(sql, params);

    let csv = 'tanggal,nomor_induk,nama,tipe,jurusan,jenis_absensi,waktu_scan,status,yayasan\n';
    rows.forEach(r => {
      csv += `"${r.tanggal}","${r.nomor_induk}","${r.nama}","${r.tipe}","${r.jurusan || ''}","${r.jenis_absensi}","${r.waktu_scan}","${r.status}","${r.yayasan || ''}"\n`;
    });

    const exportDate = tanggal || getJakartaDate();
    res.header('Content-Type', 'text/csv');
    res.attachment(`data-absensi-${exportDate}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('export csv attendances error:', err);
    res.status(500).json({ error: 'Gagal export data absensi' });
  }
});

// Download Data Person CSV
router.get('/persons/export/csv', async (req, res) => {
  try {
    const rows = await db.query('SELECT nomor_induk, nama, tipe_person, jurusan, yayasan, qr_code, status FROM persons ORDER BY tipe_person DESC, nomor_induk ASC');

    let csv = 'nomor_induk,nama,tipe,jurusan,qr_code,status,yayasan\n';
    rows.forEach(r => {
      csv += `"${r.nomor_induk}","${r.nama}","${r.tipe_person}","${r.jurusan || ''}","${r.qr_code}","${r.status}","${r.yayasan || ''}"\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('data-person.csv');
    res.send(csv);
  } catch (err) {
    console.error('export csv persons error:', err);
    res.status(500).json({ error: 'Gagal export data person' });
  }
});

module.exports = router;
