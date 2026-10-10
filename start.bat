@echo off
title Absensi Pondok Teknologi
color 0A

echo ========================================================
echo         SISTEM ABSENSI PONDOK TEKNOLOGI
echo ========================================================
echo Memeriksa sistem...

set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan!
    echo Pastikan Node.js telah terpasang.
    pause
    exit /b
)

echo Memulai Server Aplikasi...
start "" "http://localhost:3000"
node src/server.js

pause
