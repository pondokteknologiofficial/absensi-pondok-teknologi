@echo off
title Backup Database Absensi Pondok Teknologi
color 0B

echo ========================================================
echo       BACKUP DATABASE ABSENSI PONDOK TEKNOLOGI
echo ========================================================

set "BACKUP_DIR=backup"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f %%a in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set TIMESTAMP=%%a

if exist "data\absensi.db" (
    copy /y "data\absensi.db" "%BACKUP_DIR%\absensi_backup_%TIMESTAMP%.db" >nul
    echo.
    echo [SUKSES] Database berhasil dicadangkan ke:
    echo   %BACKUP_DIR%\absensi_backup_%TIMESTAMP%.db
    echo.
) else (
    echo.
    echo [PERINGATAN] File data\absensi.db belum ditemukan.
    echo Silakan jalankan aplikasi terlebih dahulu.
    echo.
)

pause
