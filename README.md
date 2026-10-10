# Sistem Absensi Pondok Teknologi

Aplikasi absensi mandiri untuk Santri dan Pengurus Pondok Teknologi menggunakan **PC Windows + Scanner QR Code 2D USB model kasir**.

---

## 1. File dan Folder Utama

```text
Absensi - Pondok Teknologi/
├── start.bat                <-- KLIK 2x UNTUK MENJALANKAN APLIKASI
├── backup.bat               <-- KLIK 2x UNTUK CADANGKAN DATABASE
├── package.json             <-- Konfigurasi dependensi aplikasi
├── README.md                <-- Panduan lengkap ini
│
├── data/
│   └── absensi.db           <-- File database SQLite utama
│
├── src/
│   ├── server.js            <-- Server utama aplikasi
│   ├── config.js            <-- Konfigurasi zona waktu (Asia/Jakarta) & port
│   ├── db.js                <-- Modul database SQLite (otomatis simpan ke disk)
│   ├── rules.js             <-- Logika aturan waktu Shalat & Produktif
│   ├── seed.js              <-- Data awal 6 orang santri & pengurus
│   └── routes/
│       └── api.js           <-- Jalur komunikasi data (API REST)
│
├── public/
│   ├── index.html           <-- Layar Kiosk Scanner Absensi
│   ├── admin.html           <-- Panel Admin (Dashboard, Data Orang, Jadwal, Riwayat)
│   ├── css/
│   │   ├── kiosk.css        <-- Desain layar scanner (huruf besar, kontras tinggi)
│   │   └── admin.css        <-- Desain dashboard admin & format cetak kartu
│   └── js/
│       ├── kiosk.js         <-- Penangkap input scanner kasir & suara Web Audio
│       └── admin.js         <-- Logika interaktif panel admin & filter
│
└── tests/
    └── rules.test.js        <-- Skrip pengujian otomatis 35 aturan absensi
```

---

## 2. Cara Menjalankan Aplikasi

1. **Buka folder aplikasi**: `c:\Users\Pondok Teknologi\Desktop\Absensi - Pondok Teknologi`
2. **Klik 2x pada file `start.bat`**.
3. Aplikasi akan otomatis menyala dan browser akan langsung terbuka ke alamat:
   - **Layar Scanner (Kiosk)**: [http://localhost:3000](http://localhost:3000)
   - **Panel Admin**: [http://localhost:3000/admin](http://localhost:3000/admin)

> **Tips Kiosk / Layar Penuh**:
> Pada layar browser scanner ([http://localhost:3000](http://localhost:3000)), tekan tombol **F11** pada keyboard untuk mengubah tampilan menjadi layar penuh (fullscreen mode) agar tampak profesional seperti mesin kasir/kiosk mandiri.

---

## 3. Pilihan Metode Input Scanner (Camera vs USB)

Halaman scanner [http://localhost:3000](http://localhost:3000) dilengkapi pilihan 2 metode input:

### A. Camera Scanner (Webcam) - *Default*
* **Fungsi**: Membaca QR Code menggunakan kamera webcam internal laptop atau USB webcam.
* **Kegunaan**: Sangat ideal untuk pengujian langsung sekarang tanpa memerlukan scanner fisik.
* **Cara Pakai**:
  1. Pilih tombol **📷 Kamera (Webcam)** di atas layar scan (aktif secara otomatis).
  2. Izinkan akses kamera pada notifikasi browser (klik *Allow* / *Izinkan*).
  3. Tunjukkan kartu QR ke arah kamera laptop/PC.
  4. Kamera langsung membaca kode QR dan memproses absensi otomatis.

### B. USB QR Scanner (Model Kasir 2D)
* **Fungsi**: Membaca kartu QR menggunakan perangkat scanner kasir USB 2D.
* **Cara Pakai**:
  1. Colokkan kabel USB scanner ke PC Windows. Scanner akan langsung terdeteksi sebagai keyboard otomatis (HID/Keyboard Wedge).
  2. Pilih tombol **🔌 Scanner USB** pada layar.
  3. Arahkan kartu QR santri/pengurus ke arah sinar scanner.
  4. Scanner otomatis membaca kode dan menekan Enter.

### Arsitektur Terpadu (Single Attendance Processor)
Kedua metode input ini bermuara pada satu pemroses yang sama:
```text
Camera Scanner  ──► [QR Code] ──┐
                                ├──► [Attendance Processor] ──► Simpan ke Database
USB Scanner     ──► [QR Code] ──┘
```
Tidak ada dua sistem terpisah. Aturan bisnis, database, jam adzan, toleransi hijau/kuning/merah, serta pengecekan duplikasi berlaku 100% identik untuk kedua scanner.

---

## 4. Cara Menambahkan Santri atau Pengurus Baru

1. Buka **Panel Admin** di [http://localhost:3000/admin](http://localhost:3000/admin).
2. Pilih menu **Data Orang & QR** di bilah sisi kiri.
3. Klik tombol biru **➕ Tambah Orang Baru**.
4. Isi data:
   - **Nomor Induk**: misal `PT007`
   - **Nama Lengkap**: misal `Ahmad Zaki`
   - **Kategori**: pilih `Santri` atau `Pengurus`
   - **Jurusan / Bidang**: misal `Programming`
   - **Kode QR**: misal `QR-007` *(cukup kode unik sederhana, jangan isi data pribadi panjang)*
   - **Status**: `Aktif`
5. Klik **Simpan Data**.

---

## 5. Cara Melihat dan Mencetak Kartu QR

1. **Cetak Satuan**:
   - Di menu **Data Orang & QR**, klik tombol **👁️ QR** pada orang yang diinginkan.
   - Akan muncul tampilan kartu berisi QR Code, nama, nomor induk, dan kategori.
   - Klik tombol **🖨️ Cetak Kartu Ini**.
2. **Cetak Semua Kartu Sekaligus (Batch Print)**:
   - Di menu **Data Orang & QR**, klik tombol **🖨️ Cetak Semua Kartu QR**.
   - Sistem akan menyusun seluruh kartu santri & pengurus aktif dalam format kisi rapi siap cetak di kertas A4 / ID Card.

---

## 6. Lokasi Database & Cara Backup

* **Lokasi File Database**: `data/absensi.db`
* **Cara Backup (Pilihan 1 - Praktis lewat Web)**:
  - Buka Panel Admin -> Menu **Backup Database**.
  - Klik tombol biru **💾 Unduh Cadangan Database (.db)**. File cadangan akan langsung tersimpan di folder Download PC Anda.
* **Cara Backup (Pilihan 2 - Cukup Klik 2x)**:
  - Klik 2x file `backup.bat` di folder aplikasi.
  - Salinan file dengan stempel tanggal & jam akan otomatis dibuat di dalam folder `backup/`.

---

## 7. Aturan Waktu & Sesi Absensi (Sesuai Aturan Pondok Teknologi)

### Sesi Shalat (Subuh, Dzuhur, Ashar, Maghrib, Isya)
* **Start Scan**: 10 menit sebelum waktu adzan
* **🟢 HIJAU (Tepat Waktu)**: 10 menit sebelum adzan s/d 1 detik sebelum adzan
* **🟡 KUNING (Terlambat)**: Saat adzan s/d +10 menit setelah adzan
* **🔴 MERAH (Terlambat Berat)**: +10 menit s/d +40 menit setelah adzan
* **🚫 DITUTUP**: Lebih dari +40 menit setelah adzan

### Sesi Masuk Pagi (Target 08:00)
* **🟢 HIJAU (Hadir)**: 07:45 – 07:59
* **🟡 KUNING (Terlambat)**: 08:00 – 08:09
* **🔴 MERAH (Terlambat Berat)**: 08:10 – 08:39
* **🚫 DITUTUP**: 08:40 dst

### Sesi Masuk Siang (Target 13:00)
* **🟢 HIJAU (Hadir)**: 12:50 – 12:59
* **🟡 KUNING (Terlambat)**: 13:00 – 13:19
* **🔴 MERAH (Terlambat Berat)**: 13:20 – 13:49
* **🚫 DITUTUP**: 13:50 dst

---

## 8. Toolbar Simulasi & Pengujian

Di bagian bawah layar scanner terdapat menu lipat **🧪 Toolbar Uji Coba & Simulasi Cepat**:
* Anda dapat memilih **Simulasi Waktu** (misalnya jam 07:50 untuk menguji Hijau, jam 08:05 untuk Kuning, jam 08:25 untuk Merah, atau jam 04:15 untuk Subuh) tanpa perlu menunggu waktu asli tiba.
* Anda dapat mengklik tombol santri/pengurus (misal: Ryan, Ibnu, Farhan) untuk mencoba scan secara langsung tanpa scanner fisik.

---

## 9. Pengujian Otomatis (Automated Testing)

Untuk menjalankan seluruh 35 pengujian aturan bisnis:
```bash
npm test
```
Seluruh 35 skenario pengujian mencakup: Shalat Subuh, Masuk Pagi, Masuk Siang, scan ganda (duplicate), QR tak dikenal, person nonaktif, dan persistensi database SQLite telah teruji 100% lulus.
