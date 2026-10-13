const db = require('./db');
const { getJakartaDate } = require('./rules');
const { getPrayerTimesForDate } = require('./prayerService');

const SAMPLE_PERSONS = [
  // PONDOK TEKNOLOGI - PENGURUS
  {
    nomor_induk: 'PT001',
    nama: 'Ryan Firmansyah',
    tipe_person: 'PENGURUS',
    jurusan: 'Digital Marketing',
    yayasan: 'Pondok Teknologi',
    qr_code: 'QR-001',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT002',
    nama: 'Muhammad Nur Ibnu Hubab',
    tipe_person: 'PENGURUS',
    jurusan: 'Programming',
    yayasan: 'Pondok Teknologi',
    qr_code: 'QR-002',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT003',
    nama: 'Sulaiman Abdul Wahhab',
    tipe_person: 'PENGURUS',
    jurusan: 'Programming',
    yayasan: 'Pondok Teknologi',
    qr_code: 'QR-003',
    status: 'AKTIF'
  },
  // PONDOK TEKNOLOGI - SANTRI
  {
    nomor_induk: 'PT004',
    nama: 'Farhan Sudrajat',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    yayasan: 'Pondok Teknologi',
    qr_code: 'QR-004',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT005',
    nama: 'Muhammad Haidar Rasyid',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    yayasan: 'Pondok Teknologi',
    qr_code: 'QR-005',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT006',
    nama: 'Razqa Nazarrahman',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    yayasan: 'Pondok Teknologi',
    qr_code: 'QR-006',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT007',
    nama: 'Abu Bakar Muhammad',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    yayasan: 'Pondok Teknologi',
    qr_code: 'QR-007',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT015',
    nama: 'Hanif',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    yayasan: 'Pondok Teknologi',
    qr_code: 'QR-015',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT016',
    nama: 'Rio Rizky Fauzy',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    yayasan: 'Pondok Teknologi',
    qr_code: 'QR-016',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT017',
    nama: 'Tyo Raditya Hermawan',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    yayasan: 'Pondok Teknologi',
    qr_code: 'QR-017',
    status: 'AKTIF'
  },
  // PONDOK ENTERPRENEUR - SANTRI
  {
    nomor_induk: 'PT018',
    nama: 'Ebid El Tawwab Shoheh',
    tipe_person: 'SANTRI',
    jurusan: 'Enterpreneur',
    yayasan: 'Pondok Enterpreneur',
    qr_code: 'QR-018',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT019',
    nama: 'Hammam Abdurrahman',
    tipe_person: 'SANTRI',
    jurusan: 'Enterpreneur',
    yayasan: 'Pondok Enterpreneur',
    qr_code: 'QR-019',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT020',
    nama: 'Muhammad Ghozi Siregar',
    tipe_person: 'SANTRI',
    jurusan: 'Enterpreneur',
    yayasan: 'Pondok Enterpreneur',
    qr_code: 'QR-020',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT021',
    nama: 'Muhammad Arif Rahman',
    tipe_person: 'SANTRI',
    jurusan: 'Enterpreneur',
    yayasan: 'Pondok Enterpreneur',
    qr_code: 'QR-021',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT022',
    nama: 'Muhammad Zikri Anugrah',
    tipe_person: 'SANTRI',
    jurusan: 'Enterpreneur',
    yayasan: 'Pondok Enterpreneur',
    qr_code: 'QR-022',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT023',
    nama: 'Habibie Hakim Viandeito',
    tipe_person: 'SANTRI',
    jurusan: 'Enterpreneur',
    yayasan: 'Pondok Enterpreneur',
    qr_code: 'QR-023',
    status: 'AKTIF'
  },
  // PONDOK ANAK PENGUSAHA INDONESIA - PENGURUS
  {
    nomor_induk: 'PT008',
    nama: 'Reno Aristya Febrian',
    tipe_person: 'PENGURUS',
    jurusan: 'Pengurus',
    yayasan: 'Pondok Anak Pengusaha Indonesia',
    qr_code: 'QR-008',
    status: 'AKTIF'
  },
  // PONDOK ANAK PENGUSAHA INDONESIA - SANTRI
  {
    nomor_induk: 'PT009',
    nama: 'M. Fahmi Muftiadi',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    yayasan: 'Pondok Anak Pengusaha Indonesia',
    qr_code: 'QR-009',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT010',
    nama: 'Ali Abdullah',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    yayasan: 'Pondok Anak Pengusaha Indonesia',
    qr_code: 'QR-010',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT011',
    nama: 'Abdul Hafizh',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    yayasan: 'Pondok Anak Pengusaha Indonesia',
    qr_code: 'QR-011',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT012',
    nama: 'Muhammad Akbar',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    yayasan: 'Pondok Anak Pengusaha Indonesia',
    qr_code: 'QR-012',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT013',
    nama: 'Almay S. Rasyidi',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    yayasan: 'Pondok Anak Pengusaha Indonesia',
    qr_code: 'QR-013',
    status: 'AKTIF'
  },
  {
    nomor_induk: 'PT014',
    nama: 'Abdullah Musa',
    tipe_person: 'SANTRI',
    jurusan: 'Bisnis Digital',
    yayasan: 'Pondok Anak Pengusaha Indonesia',
    qr_code: 'QR-014',
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

  // 1. Seed Persons (Pastikan semua sample persons terdaftar & disinkronkan)
  for (const p of SAMPLE_PERSONS) {
    const existing = await db.queryOne('SELECT id FROM persons WHERE nomor_induk = ?', [p.nomor_induk]);
    if (!existing) {
      await db.run(`
        INSERT INTO persons (nomor_induk, nama, tipe_person, jurusan, yayasan, qr_code, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [p.nomor_induk, p.nama, p.tipe_person, p.jurusan, p.yayasan || 'Pondok Teknologi', p.qr_code, p.status]);
    } else {
      await db.run(`
        UPDATE persons
        SET nama = ?, tipe_person = ?, jurusan = ?, yayasan = ?, qr_code = ?, status = ?
        WHERE nomor_induk = ?
      `, [p.nama, p.tipe_person, p.jurusan, p.yayasan || 'Pondok Teknologi', p.qr_code, p.status, p.nomor_induk]);
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

async function seedPrayerScheduleForDate(dateStr, customTimes = null, region = 'YOGYAKARTA') {
  let times = customTimes;
  if (!times) {
    try {
      const calc = getPrayerTimesForDate(dateStr, region);
      times = {
        SUBUH: calc.SUBUH,
        DZUHUR: calc.DZUHUR,
        ASHAR: calc.ASHAR,
        MAGHRIB: calc.MAGHRIB,
        ISYA: calc.ISYA
      };
    } catch (e) {
      times = DEFAULT_PRAYER_TIMES;
    }
  }

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
