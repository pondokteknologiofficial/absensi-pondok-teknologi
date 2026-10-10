const config = require('./config');

// Helper: Convert "HH:mm" to minutes from midnight
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Helper: Convert minutes from midnight to "HH:mm"
function minutesToTime(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Helper: Add minutes to "HH:mm"
function addMinutes(timeStr, mins) {
  return minutesToTime(timeToMinutes(timeStr) + mins);
}

// Get current date string YYYY-MM-DD in Asia/Jakarta
function getJakartaDate(dateObj = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(dateObj); // YYYY-MM-DD
}

// Get current time string HH:mm:ss in Asia/Jakarta
function getJakartaTime(dateObj = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return formatter.format(dateObj); // HH:mm:ss
}

// Get current time string HH:mm in Asia/Jakarta
function getJakartaHHMM(dateObj = new Date()) {
  return getJakartaTime(dateObj).slice(0, 5);
}

/**
 * Calculate prayer session rules based on adhan_time
 * Adzan: T
 * Start Scan: T - 10 min
 * Hijau (PRESENT): T - 10 min up to T - 1 min (i.e. before T)
 * Kuning (LATE): T up to T + 9 min (T + 10 min boundary)
 * Merah (LATE_CRITICAL): T + 10 min up to T + 39 min (T + 40 min boundary)
 * Ditutup (CLOSED): T + 40 min onwards
 */
function buildPrayerSessionRule(prayerType, adhanTime) {
  const prayerNames = {
    SUBUH: 'Shalat Subuh',
    DZUHUR: 'Shalat Dzuhur',
    ASHAR: 'Shalat Ashar',
    MAGHRIB: 'Shalat Maghrib',
    ISYA: 'Shalat Isya'
  };

  const adhanMins = timeToMinutes(adhanTime);
  const startScanMins = adhanMins - 10;
  const yellowStartMins = adhanMins;
  const redStartMins = adhanMins + 10;
  const closeTimeMins = adhanMins + 40;

  return {
    session_code: `SHALAT_${prayerType.toUpperCase()}`,
    nama_absensi: prayerNames[prayerType.toUpperCase()] || `Shalat ${prayerType}`,
    jenis: 'SHALAT',
    adhan_time: adhanTime,
    start_scan: minutesToTime(startScanMins),
    target_time: adhanTime,
    yellow_start: minutesToTime(yellowStartMins),
    red_start: minutesToTime(redStartMins),
    close_time: minutesToTime(closeTimeMins),
    // Numeric minutes for precise evaluation
    startScanMins,
    yellowStartMins,
    redStartMins,
    closeTimeMins
  };
}

/**
 * Evaluate status for a given time "HH:mm" or "HH:mm:ss" against a session rule
 * Returns: { status, label, color, message }
 */
function evaluateSessionStatus(timeStr, session) {
  const currentMins = timeToMinutes(timeStr.slice(0, 5));
  const startMins = session.startScanMins !== undefined ? session.startScanMins : timeToMinutes(session.start_scan);
  const yellowMins = session.yellowStartMins !== undefined ? session.yellowStartMins : timeToMinutes(session.yellow_start);
  const redMins = session.redStartMins !== undefined ? session.redStartMins : timeToMinutes(session.red_start);
  const closeMins = session.closeTimeMins !== undefined ? session.closeTimeMins : timeToMinutes(session.close_time);

  if (currentMins < startMins) {
    return {
      status: 'NOT_YET',
      label: 'BELUM WAKTUNYA ABSEN',
      color: 'gray',
      message: `Absensi ${session.nama_absensi} dimulai pukul ${session.start_scan}`
    };
  }

  if (currentMins >= closeMins) {
    return {
      status: 'CLOSED',
      label: 'ABSENSI SUDAH DITUTUP',
      color: 'gray',
      message: `Sesi ${session.nama_absensi} telah ditutup pada ${session.close_time}`
    };
  }

  // Active session window:
  if (currentMins < yellowMins) {
    return {
      status: 'PRESENT',
      label: 'HADIR',
      color: 'green',
      message: 'Absen tepat waktu'
    };
  } else if (currentMins < redMins) {
    return {
      status: 'LATE',
      label: 'TERLAMBAT',
      color: 'yellow',
      message: 'Terlambat'
    };
  } else {
    return {
      status: 'LATE_CRITICAL',
      label: 'TERLAMBAT BERAT',
      color: 'red',
      message: 'Terlambat berat'
    };
  }
}

/**
 * Determine which session is active, or nearest upcoming / closed session
 * All sessions for today are sorted by start_scan
 */
function resolveCurrentSession(allSessions, currentTimeStr) {
  if (!allSessions || allSessions.length === 0) {
    return null;
  }

  const currentMins = timeToMinutes(currentTimeStr.slice(0, 5));

  // Sort sessions by start_scan minutes
  const sorted = [...allSessions].sort((a, b) => {
    const aStart = a.startScanMins !== undefined ? a.startScanMins : timeToMinutes(a.start_scan);
    const bStart = b.startScanMins !== undefined ? b.startScanMins : timeToMinutes(b.start_scan);
    return aStart - bStart;
  });

  // 1. Check if we are currently inside any session's active window [start_scan, close_time)
  for (const session of sorted) {
    const startMins = session.startScanMins !== undefined ? session.startScanMins : timeToMinutes(session.start_scan);
    const closeMins = session.closeTimeMins !== undefined ? session.closeTimeMins : timeToMinutes(session.close_time);

    if (currentMins >= startMins && currentMins < closeMins) {
      const evalResult = evaluateSessionStatus(currentTimeStr, session);
      return {
        session,
        isActive: true,
        evaluation: evalResult
      };
    }
  }

  // 2. If not active, find the next upcoming session today
  const upcoming = sorted.find(session => {
    const startMins = session.startScanMins !== undefined ? session.startScanMins : timeToMinutes(session.start_scan);
    return startMins > currentMins;
  });

  if (upcoming) {
    return {
      session: upcoming,
      isActive: false,
      evaluation: {
        status: 'NOT_YET',
        label: 'BELUM WAKTUNYA ABSEN',
        color: 'gray',
        message: `Absensi ${upcoming.nama_absensi} dimulai pukul ${upcoming.start_scan}`
      }
    };
  }

  // 3. If past all sessions today, the last session is already closed
  const lastSession = sorted[sorted.length - 1];
  return {
    session: lastSession,
    isActive: false,
    evaluation: {
      status: 'CLOSED',
      label: 'ABSENSI SUDAH DITUTUP',
      color: 'gray',
      message: `Semua sesi absensi hari ini telah selesai (terakhir ${lastSession.nama_absensi} tutup pukul ${lastSession.close_time})`
    }
  };
}

module.exports = {
  timeToMinutes,
  minutesToTime,
  addMinutes,
  getJakartaDate,
  getJakartaTime,
  getJakartaHHMM,
  buildPrayerSessionRule,
  evaluateSessionStatus,
  resolveCurrentSession
};
