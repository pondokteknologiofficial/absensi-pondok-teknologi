# 🚀 PANDUAN DEPLOYMENT ONLINE SISTEM ABSENSI PONDOK TEKNOLOGI
*(Panduan Praktis & Mudah Dipahami untuk Pengurus & Administrator)*

Dokumen ini menjelaskan cara menjalankan atau menyebarkan (deploy) aplikasi Absensi Pondok Teknologi ke internet agar dapat digunakan bersamaan oleh banyak HP (scanner santri/pengurus) dan laptop admin secara online 24 jam.

---

## 📋 Ringkasan Arsitektur Sistem

- **Server Backend**: Node.js & Express (Melayani API, scanner, dan panel admin).
- **Database Utama**: **Supabase PostgreSQL (Online)**.
- **Database Cadangan**: SQLite lokal (`data/absensi.db`) tetap tersimpan utuh di komputer sebagai backup offline.
- **Multi-Device**:
  - HP A membuka layar Scanner (Kamera/QR) ➔ Data absensi langsung masuk ke Supabase.
  - Laptop Admin di tempat berbeda ➔ Melihat data kehadiran yang sama secara langsung (real-time).

---

## 🔑 Kebutuhan Environment Variables

Sebelum aplikasi dijalankan di server online, platform hosting hanya membutuhkan pengaturan nilai (Environment Variables) berikut:

| Nama Variabel | Wajib? | Contoh Nilai | Keterangan |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Ya | `production` | Mengaktifkan mode keamanan production |
| `PORT` | Ya | `3000` atau `8080` | Port server (biasanya diisi otomatis oleh hosting) |
| `DATABASE_URL` | **Wajib** | `postgresql://postgres.chqflpjcgcnmhirqkzvx:[PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres` | Alamat koneksi database Supabase PostgreSQL |
| `SUPABASE_URL` | Opsional | `https://chqflpjcgcnmhirqkzvx.supabase.co` | Alamat project Supabase Anda |
| `SUPABASE_PUBLISHABLE_KEY` | Opsional | `sb_publishable_...` | Public API key Supabase |

> ⚠️ **PENTING:** Jangan pernah membagikan atau meng-upload file `.env` ke GitHub publik. File `.env` sudah otomatis dicegah oleh `.gitignore`.

---

## 🌐 Pilihan Tempat Deployment (Hosting)

Aplikasi ini adalah aplikasi standar **Node.js**. Anda bisa memilih salah satu opsi berikut:

### Opsi 1: Vercel (Gratis & Cepat)
1. Buka dashboard [vercel.com](https://vercel.com) dan impor repositori GitHub ini.
2. Buka **Settings** ➔ **Environment Variables** di project Vercel Anda, lalu tambahkan:
   - `DATABASE_URL`: Alamat URI PostgreSQL Supabase Anda (Wajib agar data tersimpan permanen di cloud).
   - `SUPABASE_URL`: (Opsional) URL project Supabase Anda.
   - `NODE_ENV`: `production`
3. Klik **Deploy** (atau push commit baru ke GitHub).
4. Vercel akan otomatis mendeteksi konfigurasi `vercel.json` dan menyajikan aplikasi secara online.

### Opsi 2: Railway (Sangat Direkomendasikan & Paling Mudah)
1. Buat akun di [railway.app](https://railway.app).
2. Klik **New Project** ➔ **Deploy from GitHub repo** (pilih repositori project ini).
3. Buka tab **Variables** ➔ tambahkan variabel `DATABASE_URL`, `SUPABASE_URL`, dan `NODE_ENV=production`.
4. Railway akan otomatis menjalankan `npm start`.
5. Anda akan mendapatkan URL HTTPS gratis (contoh: `https://absensi-pondok.up.railway.app`).

### Opsi 3: Render.com (Mudah & Ada Tier Gratis)
1. Buat akun di [render.com](https://render.com).
2. Klik **New Web Service** ➔ Hubungkan dengan repositori GitHub Anda.
3. Atur:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Di bagian **Environment Variables**, tambahkan `DATABASE_URL`, `SUPABASE_URL`, dan `NODE_ENV=production`.
5. Klik **Create Web Service**. Selesai!

### Opsi 3: VPS Pribadi (Ubuntu / Debian / CyberPanel)
Jika menggunakan server sendiri (misal: DigitalOcean, IDCloudHost, Niagahoster):
1. Install Node.js v20+ di server.
2. Upload folder aplikasi ke server.
3. Buat file `.env` di server dan isi dengan kredensial database.
4. Jalankan perintah:
   ```bash
   npm install --production
   ```
5. Gunakan PM2 agar aplikasi berjalan terus-menerus di background:
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name "absensi-pondok"
   pm2 save
   pm2 startup
   ```

---

## 🏥 Cara Memeriksa Status Aplikasi (Health Check)

Setelah server berjalan, Anda dapat memeriksa kesehatan server dan koneksi database kapan saja melalui browser:

👉 Buka URL: `https://[DOMAIN-ANDA]/api/health`

**Contoh Hasil Normal:**
```json
{
  "status": "UP",
  "uptime_seconds": 3600,
  "timestamp": "2026-10-06T13:30:00.000Z",
  "database": {
    "status": "CONNECTED",
    "type": "Supabase PostgreSQL"
  },
  "environment": "production"
}
```
Jika database terhubung (`CONNECTED`), maka sistem siap digunakan 100%.

---

## 📱 Panduan Penggunaan Harian Setelah Online

1. **Layar Scanner Santri / Gerbang:**
   - Buka browser HP: `https://[DOMAIN-ANDA]/scanner`
   - Izinkan akses kamera. Arahkan ke kartu santri/pengurus.
   - Atau colokkan scanner barcode USB ke laptop gerbang (fokuskan kursor ke layar scanner).

2. **Panel Admin Pengurus:**
   - Buka: `https://[DOMAIN-ANDA]/login`
   - Masuk menggunakan akun admin Anda.
   - Anda dapat melihat rekap kehadiran, grafik shalat & jam produktif, cetak kartu QR, atau export laporan ke Excel/CSV.
