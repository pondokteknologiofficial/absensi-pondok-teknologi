// Kiosk Scanner Logic - Unified Attendance Processor for Camera & USB Scanner
(function() {
  // DOM Elements
  const scannerInput = document.getElementById('scannerInput');
  const liveClock = document.getElementById('liveClock');
  const liveDate = document.getElementById('liveDate');
  const activeSessionBadge = document.getElementById('activeSessionBadge');
  const activeSessionText = document.getElementById('activeSessionText');
  const idleSessionDetail = document.getElementById('idleSessionDetail');
  const idleSessionName = document.getElementById('idleSessionName');
  const idleSessionHours = document.getElementById('idleSessionHours');
  const idleTitle = document.getElementById('idleTitle');
  const idleSubtitle = document.getElementById('idleSubtitle');

  // Mode Switcher Elements
  const modeCameraBtn = document.getElementById('modeCameraBtn');
  const modeUsbBtn = document.getElementById('modeUsbBtn');
  const cameraScannerWrapper = document.getElementById('cameraScannerWrapper');
  const usbScannerFrame = document.getElementById('usbScannerFrame');
  const cameraSelect = document.getElementById('cameraSelect');
  const cameraReloadBtn = document.getElementById('cameraReloadBtn');
  const cameraErrorBox = document.getElementById('cameraErrorBox');
  const cameraErrorMessage = document.getElementById('cameraErrorMessage');
  const cameraRetryBtn = document.getElementById('cameraRetryBtn');

  // Screens
  const idleScreen = document.getElementById('idleScreen');
  const resultScreen = document.getElementById('resultScreen');
  const resultCard = document.getElementById('resultCard');
  const resultBadge = document.getElementById('resultBadge');
  const resultIcon = document.getElementById('resultIcon');
  const resultStatusText = document.getElementById('resultStatusText');
  const resultPersonName = document.getElementById('resultPersonName');
  const resultPersonMeta = document.getElementById('resultPersonMeta');
  const resultRolePill = document.getElementById('resultRolePill');
  const resultJurusan = document.getElementById('resultJurusan');
  const resultNomorInduk = document.getElementById('resultNomorInduk');
  const resultDetailsGrid = document.getElementById('resultDetailsGrid');
  const resultSessionName = document.getElementById('resultSessionName');
  const resultScanTime = document.getElementById('resultScanTime');
  const resultMessage = document.getElementById('resultMessage');
  const countdownBar = document.getElementById('countdownBar');
  const countdownText = document.getElementById('countdownText');

  // Controls & Drawer
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');
  const simToggleBtn = document.getElementById('simToggleBtn');
  const simulationDrawer = document.getElementById('simulationDrawer');
  const simArrow = document.getElementById('simArrow');
  const simTimeSelect = document.getElementById('simTimeSelect');

  // State
  let activeMode = 'camera'; // Default: Camera Scanner
  let autoResetTimer = null;
  let isSoundEnabled = true;
  let audioCtx = null;
  let isProcessingScan = false;
  let globalScanBuffer = '';
  let lastKeyTime = Date.now();

  // Camera instance (Html5Qrcode)
  let html5QrScanner = null;
  let isCameraScanning = false;
  let lastScannedCode = '';
  let lastScannedTime = 0;

  // ============================================================
  // 1. Web Audio Synthesizer (Zero External Audio File Dependency)
  // ============================================================
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type, duration, delay = 0) {
    if (!isSoundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;

      setTimeout(() => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      }, delay);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  function playSound(type) {
    if (!isSoundEnabled) return;
    switch (type) {
      case 'green': // Pleasant ascending chord
        playTone(523.25, 'sine', 0.15, 0);   // C5
        playTone(659.25, 'sine', 0.18, 100); // E5
        playTone(783.99, 'sine', 0.35, 200); // G5
        break;
      case 'yellow': // Double warning beep
        playTone(440, 'triangle', 0.12, 0);
        playTone(440, 'triangle', 0.20, 150);
        break;
      case 'red': // Low alert beep
        playTone(330, 'sawtooth', 0.35, 0);
        break;
      case 'gray': // Subtle double tap
        playTone(260, 'sine', 0.15, 0);
        playTone(320, 'sine', 0.18, 120);
        break;
      case 'error': // Buzzer
        playTone(180, 'sawtooth', 0.4, 0);
        break;
    }
  }

  // ============================================================
  // 2. Realtime Clock (Asia/Jakarta timezone)
  // ============================================================
  function updateClock() {
    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const dateFormatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    liveClock.textContent = timeFormatter.format(now).replace(/\./g, ':');
    liveDate.textContent = dateFormatter.format(now);
  }

  setInterval(updateClock, 1000);
  updateClock();

  // ============================================================
  // 3. UNIFIED ATTENDANCE PROCESSOR
  // Camera Scanner -> QR Code -> Attendance Processor
  // USB Scanner    -> QR Code -> Attendance Processor
  // Simulation     -> QR Code -> Attendance Processor
  // ============================================================
  async function attendanceProcessor(qrCode) {
    if (!qrCode || typeof qrCode !== 'string') return;
    const cleanCode = qrCode.trim();
    if (!cleanCode) return;

    // Prevent immediate re-scan spam within 1 second for same code
    const now = Date.now();
    if (cleanCode === lastScannedCode && now - lastScannedTime < 1500) {
      return;
    }

    if (isProcessingScan) return;
    isProcessingScan = true;
    lastScannedCode = cleanCode;
    lastScannedTime = now;

    if (autoResetTimer) {
      clearTimeout(autoResetTimer);
      autoResetTimer = null;
    }

    // Pause camera stream while showing result
    pauseCameraScanning();

    const simulatedTime = simTimeSelect.value || null;

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_code: cleanCode,
          test_time: simulatedTime
        })
      });

      const data = await response.json();
      displayResult(data);
    } catch (err) {
      console.error('Attendance Processor Error:', err);
      displayResult({
        success: false,
        status: 'CLOSED',
        label: 'GAGAL TERHUBUNG',
        color: 'red',
        message: 'Koneksi ke server terputus. Silakan coba kembali.'
      });
    } finally {
      isProcessingScan = false;
      ensureFocus();
    }
  }

  // Display Result Card
  function displayResult(res) {
    resultCard.className = 'result-card';
    resultCard.classList.add(`status-${res.color || 'gray'}`);

    // Set Sound
    if (res.color === 'green') playSound('green');
    else if (res.color === 'yellow') playSound('yellow');
    else if (res.color === 'red' && res.status === 'LATE_CRITICAL') playSound('red');
    else if (res.color === 'red') playSound('error');
    else playSound('gray');

    // Status Badge & Icon
    let icon = '✅';
    let statusTitle = res.label || 'HASIL SCAN';

    if (res.status === 'PRESENT') {
      icon = '✅';
      statusTitle = 'ABSEN BERHASIL';
    } else if (res.status === 'LATE') {
      icon = '🟡';
      statusTitle = 'TERLAMBAT';
    } else if (res.status === 'LATE_CRITICAL') {
      icon = '🔴';
      statusTitle = 'TERLAMBAT BERAT';
    } else if (res.status === 'DUPLICATE') {
      icon = 'ℹ️';
      statusTitle = 'SUDAH ABSEN';
    } else if (res.status === 'NOT_YET') {
      icon = '⛔';
      statusTitle = 'BELUM WAKTUNYA ABSEN';
    } else if (res.status === 'CLOSED') {
      icon = '🚫';
      statusTitle = 'ABSENSI SUDAH DITUTUP';
    } else if (res.status === 'INVALID_QR') {
      icon = '❌';
      statusTitle = 'QR TIDAK TERDAFTAR';
    } else if (res.status === 'INACTIVE_PERSON') {
      icon = '❌';
      statusTitle = 'DATA TIDAK AKTIF';
    }

    resultIcon.textContent = icon;
    resultStatusText.textContent = statusTitle;

    // Person Information
    if (res.person) {
      resultPersonName.style.display = 'block';
      resultPersonName.textContent = res.person.nama;

      resultPersonMeta.style.display = 'flex';
      const role = (res.person.tipe_person || '').toUpperCase();
      resultRolePill.textContent = role === 'PENGURUS' ? 'Pengurus' : 'Santri';
      resultRolePill.className = `role-pill ${role === 'PENGURUS' ? 'pengurus' : 'santri'}`;
      resultJurusan.textContent = res.person.jurusan || '-';
      resultNomorInduk.textContent = res.person.nomor_induk ? `(${res.person.nomor_induk})` : '';
    } else {
      resultPersonName.style.display = 'block';
      resultPersonName.textContent = res.scanned_code ? `Kode: ${res.scanned_code}` : 'Pondok Teknologi';
      resultPersonMeta.style.display = 'none';
    }

    // Attendance Details
    if (res.session && (res.status === 'PRESENT' || res.status === 'LATE' || res.status === 'LATE_CRITICAL')) {
      resultDetailsGrid.style.display = 'grid';
      resultSessionName.textContent = res.session.nama_absensi || '-';
      resultScanTime.textContent = res.waktu_scan || '-';
    } else if (res.status === 'DUPLICATE') {
      resultDetailsGrid.style.display = 'grid';
      resultSessionName.textContent = (res.session && res.session.nama_absensi) || 'Sesi Ini';
      resultScanTime.textContent = res.existing_time ? `Pukul ${res.existing_time}` : '-';
    } else {
      resultDetailsGrid.style.display = 'none';
    }

    resultMessage.textContent = res.message || '';

    // Switch screen to Result
    idleScreen.style.display = 'none';
    resultScreen.style.display = 'flex';

    // Countdown animation
    countdownBar.style.animation = 'none';
    void countdownBar.offsetWidth;
    countdownBar.style.animation = 'countdown-drain 4s linear forwards';
    countdownText.textContent = 'Kembali ke layar scan dalam 4 detik...';

    // Schedule auto return to idle
    autoResetTimer = setTimeout(() => {
      resetToIdle();
    }, 4000);
  }

  function resetToIdle() {
    if (autoResetTimer) {
      clearTimeout(autoResetTimer);
      autoResetTimer = null;
    }
    resultScreen.style.display = 'none';
    idleScreen.style.display = 'flex';
    fetchCurrentSession();
    ensureFocus();

    // Resume camera scanning if in camera mode
    resumeCameraScanning();
  }

  // ============================================================
  // 4. CAMERA SCANNER ENGINE (Html5Qrcode)
  // ============================================================
  async function initCameraScanner() {
    if (typeof Html5Qrcode === 'undefined') {
      console.warn('Html5Qrcode library not loaded.');
      showCameraError('Pustaka scanner kamera gagal dimuat.');
      return;
    }

    if (!html5QrScanner) {
      html5QrScanner = new Html5Qrcode("cameraReader");
    }

    cameraErrorBox.style.display = 'none';

    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        showCameraError('Tidak ada kamera/webcam yang terdeteksi di perangkat.');
        return;
      }

      // Populate camera select dropdown
      cameraSelect.innerHTML = devices.map(d => `<option value="${d.id}">${d.label || 'Kamera ' + d.id}</option>`).join('');

      // Prefer back/environment camera or first available
      const cameraId = devices[0].id;
      await startCameraStream(cameraId);
    } catch (err) {
      console.warn('Camera detection error:', err);
      showCameraError('Izin akses kamera belum diberikan atau kamera sedang digunakan aplikasi lain.');
    }
  }

  async function startCameraStream(cameraId) {
    if (!html5QrScanner) return;
    try {
      if (isCameraScanning) {
        await html5QrScanner.stop();
        isCameraScanning = false;
      }

      cameraErrorBox.style.display = 'none';

      const config = {
        fps: 15,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.333334
      };

      await html5QrScanner.start(
        cameraId,
        config,
        (decodedText) => {
          // Camera successfully detected a QR Code
          attendanceProcessor(decodedText);
        },
        (errorMessage) => {
          // Frame by frame decode failure (normal when no QR is in view)
        }
      );

      isCameraScanning = true;
    } catch (err) {
      console.error('Failed to start camera stream:', err);
      showCameraError('Gagal menyalakan video kamera. Pastikan browser diizinkan mengakses kamera.');
    }
  }

  function pauseCameraScanning() {
    if (html5QrScanner && isCameraScanning) {
      try {
        html5QrScanner.pause();
      } catch (e) {
        console.warn('Error pausing camera:', e);
      }
    }
  }

  function resumeCameraScanning() {
    if (html5QrScanner && isCameraScanning && activeMode === 'camera') {
      try {
        html5QrScanner.resume();
      } catch (e) {
        console.warn('Error resuming camera:', e);
      }
    }
  }

  async function stopCameraScanner() {
    if (html5QrScanner && isCameraScanning) {
      try {
        await html5QrScanner.stop();
        isCameraScanning = false;
      } catch (e) {
        console.warn('Error stopping camera:', e);
      }
    }
  }

  function showCameraError(msg) {
    cameraErrorMessage.textContent = msg;
    cameraErrorBox.style.display = 'flex';
  }

  cameraReloadBtn.addEventListener('click', () => {
    if (cameraSelect.value) {
      startCameraStream(cameraSelect.value);
    } else {
      initCameraScanner();
    }
  });

  cameraSelect.addEventListener('change', () => {
    if (cameraSelect.value) {
      startCameraStream(cameraSelect.value);
    }
  });

  cameraRetryBtn.addEventListener('click', () => {
    initCameraScanner();
  });

  // ============================================================
  // 5. USB SCANNER (Keyboard Wedge Handler)
  // ============================================================
  function ensureFocus() {
    if (document.activeElement !== scannerInput && !document.activeElement.classList.contains('sim-time-select') && !document.activeElement.classList.contains('camera-select')) {
      scannerInput.focus();
    }
  }

  document.addEventListener('click', (e) => {
    initAudio();
    if (!e.target.closest('#simulationDrawer') &&
        !e.target.closest('select') &&
        !e.target.closest('button') &&
        !e.target.closest('a')) {
      ensureFocus();
    }
  });

  // Global keystroke listener: catches USB 2D scanner keyboard wedge
  document.addEventListener('keydown', (e) => {
    initAudio();

    if (e.target.tagName === 'INPUT' && e.target !== scannerInput) return;
    if (e.target.tagName === 'SELECT') return;

    if (e.key === 'Enter') {
      const code = scannerInput.value.trim() || globalScanBuffer.trim();
      scannerInput.value = '';
      globalScanBuffer = '';
      if (code) {
        attendanceProcessor(code);
      }
      return;
    }

    if (e.key.length === 1) {
      const now = Date.now();
      if (now - lastKeyTime > 500) {
        globalScanBuffer = '';
      }
      lastKeyTime = now;
      globalScanBuffer += e.key;
    }
  });

  scannerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = scannerInput.value.trim();
      scannerInput.value = '';
      if (code) {
        attendanceProcessor(code);
      }
    }
  });

  // ============================================================
  // 6. SCANNER MODE SWITCHER (Camera vs USB)
  // ============================================================
  function setScannerMode(mode) {
    activeMode = mode;

    if (mode === 'camera') {
      modeCameraBtn.classList.add('active');
      modeUsbBtn.classList.remove('active');

      cameraScannerWrapper.style.display = 'flex';
      usbScannerFrame.style.display = 'none';

      idleTitle.textContent = 'SIAP SCAN QR';
      idleSubtitle.textContent = 'Arahkan kartu QR code Anda ke arah kamera komputer. Absensi akan langsung tercatat otomatis.';

      initCameraScanner();
    } else {
      modeUsbBtn.classList.add('active');
      modeCameraBtn.classList.remove('active');

      cameraScannerWrapper.style.display = 'none';
      usbScannerFrame.style.display = 'flex';

      idleTitle.textContent = 'SIAP SCAN QR';
      idleSubtitle.textContent = 'Arahkan kartu QR code Anda ke scanner kasir USB. Absensi akan langsung tercatat otomatis.';

      stopCameraScanner();
      ensureFocus();
    }
  }

  modeCameraBtn.addEventListener('click', () => setScannerMode('camera'));
  modeUsbBtn.addEventListener('click', () => setScannerMode('usb'));

  // Default mode: Camera Scanner
  setScannerMode('camera');

  // ============================================================
  // 7. Active Session Polling
  // ============================================================
  async function fetchCurrentSession() {
    try {
      const res = await fetch('/api/session/current');
      if (!res.ok) return;
      const data = await res.json();

      if (data.active_session) {
        activeSessionText.textContent = `Sesi Aktif: ${data.active_session.nama_absensi} (${data.active_session.start_scan} - ${data.active_session.close_time})`;
        activeSessionBadge.style.color = '#38bdf8';
        idleSessionName.textContent = `Sesi Aktif: ${data.active_session.nama_absensi}`;
        idleSessionHours.textContent = `${data.active_session.start_scan} - ${data.active_session.close_time}`;
      } else if (data.next_or_last_session) {
        if (data.evaluation && data.evaluation.status === 'NOT_YET') {
          activeSessionText.textContent = `Sesi Berikutnya: ${data.next_or_last_session.nama_absensi} (Mulai ${data.next_or_last_session.start_scan})`;
          activeSessionBadge.style.color = '#cbd5e1';
          idleSessionName.textContent = `Sesi Berikutnya: ${data.next_or_last_session.nama_absensi}`;
          idleSessionHours.textContent = `Mulai ${data.next_or_last_session.start_scan}`;
        } else {
          activeSessionText.textContent = `Absensi Selesai / Ditutup (${data.next_or_last_session.nama_absensi})`;
          activeSessionBadge.style.color = '#94a3b8';
          idleSessionName.textContent = 'Semua Sesi Telah Ditutup';
          idleSessionHours.textContent = `Terakhir: ${data.next_or_last_session.nama_absensi} (${data.next_or_last_session.close_time})`;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch session info:', err);
    }
  }

  fetchCurrentSession();
  setInterval(fetchCurrentSession, 10000);

  // ============================================================
  // 8. Simulation Drawer & Quick Testing
  // ============================================================
  simToggleBtn.addEventListener('click', () => {
    simulationDrawer.classList.toggle('collapsed');
    const isCollapsed = simulationDrawer.classList.contains('collapsed');
    simArrow.textContent = isCollapsed ? '▲ Buka Pengujian' : '▼ Tutup Pengujian';
  });

  document.querySelectorAll('.sim-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const qr = e.target.getAttribute('data-qr');
      if (qr) {
        attendanceProcessor(qr);
      }
    });
  });

  soundToggleBtn.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    soundIcon.textContent = isSoundEnabled ? '🔊' : '🔇';
    soundToggleBtn.style.opacity = isSoundEnabled ? '1' : '0.6';
    if (isSoundEnabled) initAudio();
  });

})();
