const db = require('./db');
const { getJakartaDate } = require('./rules');

const SAMPLE_PERSONS = [
  // PENGURUS
  {
    nomor_induk: 'PT001',
    nama: 'Ryan Firmansyah',
    tipe_person: 'PENGURUS',
    jurusan: 'Digital Marketing',
    qr_code: 'QR-001',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT002',
    nama: 'M Nur Ibnu Hubab',
    tipe_person: 'PENGURUS',
    jurusan: 'Programming',
    qr_code: 'QR-002',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT003',
    nama: 'Sulaiman',
    tipe_person: 'PENGURUS',
    jurusan: 'Programming',
    qr_code: 'QR-003',
    status: 'AKTIF'
  },
  // SANTRI
  {
    nomor_induk: 'PT004',
    nama: 'Farhan Sudrajat',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    qr_code: 'QR-004',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT005',
    nama: 'Muhammad Haidar Rasyid',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    qr_code: 'QR-005',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT006',
    nama: 'Razqa Nazarrahman',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    qr_code: 'QR-006',
    status: 'AKTIF'
  }
];

const DEFAULT_PRODUCTIVE_RULES = [
  {
    session_code: 'MASUK_PAGI',
    nama_absensi: 'Masuk Pagi',
    jenis: 'PRODUKTIF',
    start_scan: '07:45',
    target_time: '08:00',
    yellow_start: '08:00',
    red_start: '08:10',
    close_time: '08:40',
    active: 1
  },
  {
    session_code: 'MASUK_SIANG',
    nama_absensi: 'Masuk Siang',
    jenis: 'PRODUKTIF',
    start_scan: '12:50',
    target_time: '13:00',
    yellow_start: '13:00',
    red_start: '13:20',
    close_time: '13:50',
    active: 1
  }
];

const DEFAULT_PRAYER_TIMES = {
  SUBUH: '04:20',
  DZUHUR: '11:45',
  ASHAR: '15:00',
  MAGHRIB: '17:50',
  ISYA: '19:05'
};

async function seedDatabase(force = false) {
  await db.initDb();

  // 1. Seed Persons
  const personCount = await db.queryOne('SELECT COUNT(*) as cnt FROM persons');
  if (force || !personCount || Number(personCount.cnt) === 0) {
    for (const p of SAMPLE_PERSONS) {
      const existing = await db.queryOne('SELECT id FROM persons WHERE nomor_induk = ? OR qr_code = ?', [p.nomor_induk, p.qr_code]);
      if (!existing) {
        await db.run(`
          INSERT INTO persons (nomor_induk, nama, tipe_person, jurusan, qr_code, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [p.nomor_induk, p.nama, p.tipe_person, p.jurusan, p.qr_code, p.status]);
      }
    }
  }

  // 2. Seed Attendance Rules (Masuk Pagi & Masuk Siang)
  for (const r of DEFAULT_PRODUCTIVE_RULES) {
    const existingRule = await db.queryOne('SELECT id FROM attendance_rules WHERE session_code = ?', [r.session_code]);
    if (!existingRule) {
      await db.run(`
        INSERT INTO attendance_rules (session_code, nama_absensi, jenis, start_scan, target_time, yellow_start, red_start, close_time, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [r.session_code, r.nama_absensi, r.jenis, r.start_scan, r.target_time, r.yellow_start, r.red_start, r.close_time, r.active]);
    }
  }

  // 3. Seed Default Prayer Schedules for Today and surrounding days (if not already set)
  const today = getJakartaDate();
  await seedPrayerScheduleForDate(today);

  // Also ensure tomorrow has prayer schedules
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrow = getJakartaDate(tomorrowObj);
  await seedPrayerScheduleForDate(tomorrow);

  db.save();
}

async function seedPrayerScheduleForDate(dateStr, customTimes = null) {
  const times = customTimes || DEFAULT_PRAYER_TIMES;
  for (const [prayer, adhan] of Object.entries(times)) {
    const existing = await db.queryOne('SELECT id FROM prayer_schedules WHERE tanggal = ? AND prayer_type = ?', [dateStr, prayer]);
    if (!existing) {
      await db.run(`
        INSERT INTO prayer_schedules (tanggal, prayer_type, adhan_time)
        VALUES (?, ?, ?)
      `, [dateStr, prayer, adhan]);
    }
  }
}

module.exports = {
  SAMPLE_PERSONS,
  DEFAULT_PRODUCTIVE_RULES,
  DEFAULT_PRAYER_TIMES,
  seedDatabase,
  seedPrayerScheduleForDate
};
