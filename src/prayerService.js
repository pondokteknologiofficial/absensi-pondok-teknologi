const { Coordinates, CalculationMethod, PrayerTimes, Madhab } = require('adhan');

// Daftar koordinat wilayah Daerah Istimewa Yogyakarta dan sekitarnya
const REGIONS = {
  YOGYAKARTA: {
    key: 'YOGYAKARTA',
    nama: 'Kota Yogyakarta',
    latitude: -7.7956,
    longitude: 110.3695
  },
  SLEMAN: {
    key: 'SLEMAN',
    nama: 'Kabupaten Sleman',
    latitude: -7.7156,
    longitude: 110.3556
  },
  BANTUL: {
    key: 'BANTUL',
    nama: 'Kabupaten Bantul',
    latitude: -7.8938,
    longitude: 110.3306
  },
  KULON_PROGO: {
    key: 'KULON_PROGO',
    nama: 'Kabupaten Kulon Progo',
    latitude: -7.8286,
    longitude: 110.1607
  },
  GUNUNGKIDUL: {
    key: 'GUNUNGKIDUL',
    nama: 'Kabupaten Gunungkidul',
    latitude: -7.9609,
    longitude: 110.6033
  }
};

/**
 * Format objek Date ke string HH:mm (WIB / Asia/Jakarta)
 */
function formatTimeWib(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return '00:00';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(dateObj).replace('.', ':');
}

/**
 * Menghitung waktu shalat secara astronomis untuk tanggal dan wilayah tertentu
 * Menggunakan standar hisab Kemenag RI:
 * - Sudut Subuh: 20.0 derajat
 * - Sudut Isya: 18.0 derajat
 * - Ashar: Madzhab Syafi'i (1x panjang bayangan)
 * - Ihtiyat (Pengaman waktu adzan): +2 menit
 *
 * @param {string} dateStr Format 'YYYY-MM-DD'
 * @param {string} regionKey Key wilayah (default: 'YOGYAKARTA')
 * @returns {object} { SUBUH, DZUHUR, ASHAR, MAGHRIB, ISYA } dalam format HH:mm
 */
function getPrayerTimesForDate(dateStr, regionKey = 'YOGYAKARTA') {
  const reg = REGIONS[regionKey] || REGIONS.YOGYAKARTA;
  const coordinates = new Coordinates(reg.latitude, reg.longitude);

  let dateObj;
  if (dateStr) {
    const parts = dateStr.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    // Jam 12:00:00 siang WIB untuk kestabilan perhitungan tanggal matahari
    dateObj = new Date(Date.UTC(y, m, d, 5, 0, 0)); // UTC 05:00 = 12:00 WIB
  } else {
    dateObj = new Date();
  }

  // Gunakan metode standar Kemenag RI / Singapore base
  const params = CalculationMethod.Singapore();
  params.fajrAngle = 20.0;
  params.ishaAngle = 18.0;
  params.madhab = Madhab.Shafi;

  // Ihtiyat +2 menit pengaman hisab Kemenag
  params.adjustments = {
    fajr: 2,
    dhuhr: 2,
    asr: 2,
    maghrib: 2,
    isha: 2
  };

  const prayerTimes = new PrayerTimes(coordinates, dateObj, params);

  return {
    SUBUH: formatTimeWib(prayerTimes.fajr),
    DZUHUR: formatTimeWib(prayerTimes.dhuhr),
    ASHAR: formatTimeWib(prayerTimes.asr),
    MAGHRIB: formatTimeWib(prayerTimes.maghrib),
    ISYA: formatTimeWib(prayerTimes.isha),
    region: reg.nama,
    tanggal: dateStr
  };
}

module.exports = {
  REGIONS,
  getPrayerTimesForDate
};
