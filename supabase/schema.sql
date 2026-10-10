-- ====================================================================
-- SCHEMA DATABASE SUPABASE POSTGRESQL UNTUK SISTEM ABSENSI PONDOK TEKNOLOGI
-- ====================================================================

-- 1. Tabel Persons (Santri & Pengurus)
CREATE TABLE IF NOT EXISTS persons (
    id SERIAL PRIMARY KEY,
    nomor_induk VARCHAR(50) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    tipe_person VARCHAR(50) NOT NULL, -- SANTRI / PENGURUS
    jurusan VARCHAR(100),
    qr_code VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AKTIF', -- AKTIF / NONAKTIF
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 2. Tabel Attendance Rules (Jadwal Produktif: Masuk Pagi & Masuk Siang)
CREATE TABLE IF NOT EXISTS attendance_rules (
    id SERIAL PRIMARY KEY,
    session_code VARCHAR(50) UNIQUE NOT NULL, -- MASUK_PAGI, MASUK_SIANG
    nama_absensi VARCHAR(100) NOT NULL,
    jenis VARCHAR(50) NOT NULL, -- PRODUKTIF / SHALAT
    start_scan VARCHAR(10) NOT NULL, -- HH:mm
    target_time VARCHAR(10) NOT NULL, -- HH:mm
    yellow_start VARCHAR(10) NOT NULL, -- HH:mm
    red_start VARCHAR(10) NOT NULL, -- HH:mm
    close_time VARCHAR(10) NOT NULL, -- HH:mm
    active INTEGER DEFAULT 1,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 3. Tabel Prayer Schedules (Jadwal Shalat 5 Waktu)
CREATE TABLE IF NOT EXISTS prayer_schedules (
    id SERIAL PRIMARY KEY,
    tanggal VARCHAR(10) NOT NULL, -- YYYY-MM-DD
    prayer_type VARCHAR(20) NOT NULL, -- SUBUH, DZUHUR, ASHAR, MAGHRIB, ISYA
    adhan_time VARCHAR(10) NOT NULL, -- HH:mm
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    CONSTRAINT uq_prayer_date_type UNIQUE (tanggal, prayer_type)
);

-- 4. Tabel Attendances (Riwayat & Log Kehadiran)
CREATE TABLE IF NOT EXISTS attendances (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    session_code VARCHAR(50) NOT NULL,
    nama_absensi VARCHAR(100) NOT NULL,
    tanggal VARCHAR(10) NOT NULL, -- YYYY-MM-DD
    waktu_scan VARCHAR(10) NOT NULL, -- HH:mm:ss
    status VARCHAR(30) NOT NULL, -- PRESENT, LATE, LATE_CRITICAL, ABSENT, DUPLICATE
    keterangan TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    CONSTRAINT uq_attendances_person_session_date UNIQUE (person_id, session_code, tanggal)
);

-- 5. Tabel Users (Akun Admin)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 6. Tabel Sessions (Sesi Login Admin)
CREATE TABLE IF NOT EXISTS sessions (
    token VARCHAR(128) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at VARCHAR(30) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 7. Tabel System Settings (Pengaturan Sistem & Log Backup)
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- INDEXES UNTUK PERFORMA TINGGI
CREATE INDEX IF NOT EXISTS idx_attendances_date ON attendances(tanggal);
CREATE INDEX IF NOT EXISTS idx_attendances_person ON attendances(person_id);
CREATE INDEX IF NOT EXISTS idx_attendances_session ON attendances(session_code);
CREATE INDEX IF NOT EXISTS idx_persons_qr ON persons(qr_code);
CREATE INDEX IF NOT EXISTS idx_persons_nomor_induk ON persons(nomor_induk);
CREATE INDEX IF NOT EXISTS idx_prayer_date ON prayer_schedules(tanggal);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- ROW LEVEL SECURITY (RLS) UNTUK KEAMANAN
-- Mengaktifkan RLS tanpa open policy publik memastikan anon / client-side key tidak bisa mengeksploitasi data.
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
