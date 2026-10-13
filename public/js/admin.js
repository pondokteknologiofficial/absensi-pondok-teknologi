// Admin Panel Logic - Complete Implementation with Route Protection & State Management
(function() {
  // Navigation & Shell
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const pageHeading = document.getElementById('pageHeading');
  const pageSubheading = document.getElementById('pageSubheading');
  const globalDateFilter = document.getElementById('globalDateFilter');
  const refreshDataBtn = document.getElementById('refreshDataBtn');
  const adminUsername = document.getElementById('adminUsername');
  const logoutBtn = document.getElementById('logoutBtn');

  // Dashboard Elements
  const statTotalPersons = document.getElementById('statTotalPersons');
  const statHadir = document.getElementById('statHadir');
  const statTerlambat = document.getElementById('statTerlambat');
  const statTerlambatBerat = document.getElementById('statTerlambatBerat');
  const statTotalScans = document.getElementById('statTotalScans');

  const dashSantriTotal = document.getElementById('dashSantriTotal');
  const dashSantriHadir = document.getElementById('dashSantriHadir');
  const dashSantriLate = document.getElementById('dashSantriLate');
  const dashSantriLateCrit = document.getElementById('dashSantriLateCrit');
  const dashSantriSum = document.getElementById('dashSantriSum');

  const dashPengurusTotal = document.getElementById('dashPengurusTotal');
  const dashPengurusHadir = document.getElementById('dashPengurusHadir');
  const dashPengurusLate = document.getElementById('dashPengurusLate');
  const dashPengurusLateCrit = document.getElementById('dashPengurusLateCrit');
  const dashPengurusSum = document.getElementById('dashPengurusSum');

  const sessionBreakdownTbody = document.getElementById('sessionBreakdownTbody');
  const recentScansTbody = document.getElementById('recentScansTbody');

  // Persons Elements
  const personsTable = document.getElementById('personsTable');
  const personsTbody = document.getElementById('personsTbody');
  const personSearchInput = document.getElementById('personSearchInput');
  const personYayasanFilter = document.getElementById('personYayasanFilter');
  const personRoleFilter = document.getElementById('personRoleFilter');
  const personStatusFilter = document.getElementById('personStatusFilter');
  const personSortFilter = document.getElementById('personSortFilter');
  const addPersonBtn = document.getElementById('addPersonBtn');
  const batchPrintQrBtn = document.getElementById('batchPrintQrBtn');

  let personSort = { col: null, order: 'ASC' };

  // Modals
  const personModal = document.getElementById('personModal');
  const personForm = document.getElementById('personForm');
  const personFormId = document.getElementById('personFormId');
  const personNomorInduk = document.getElementById('personNomorInduk');
  const personNama = document.getElementById('personNama');
  const personTipe = document.getElementById('personTipe');
  const personYayasan = document.getElementById('personYayasan');
  const personJurusan = document.getElementById('personJurusan');
  const personQrCode = document.getElementById('personQrCode');
  const personStatus = document.getElementById('personStatus');
  const personModalTitle = document.getElementById('personModalTitle');
  const deletePersonModalBtn = document.getElementById('deletePersonModalBtn');

  const qrModal = document.getElementById('qrModal');
  const qrModalImage = document.getElementById('qrModalImage');
  const qrModalName = document.getElementById('qrModalName');
  const qrModalMeta = document.getElementById('qrModalMeta');
  const qrModalCode = document.getElementById('qrModalCode');
  const printSingleQrBtn = document.getElementById('printSingleQrBtn');

  // Productive Rules Elements
  const productiveCardsContainer = document.getElementById('productiveCardsContainer');
  const productiveRulesTbody = document.getElementById('productiveRulesTbody');
  const ruleModal = document.getElementById('ruleModal');
  const ruleForm = document.getElementById('ruleForm');
  const ruleFormId = document.getElementById('ruleFormId');
  const ruleNamaAbsensi = document.getElementById('ruleNamaAbsensi');
  const ruleStartScan = document.getElementById('ruleStartScan');
  const ruleTargetTime = document.getElementById('ruleTargetTime');
  const ruleYellowStart = document.getElementById('ruleYellowStart');
  const ruleRedStart = document.getElementById('ruleRedStart');
  const ruleCloseTime = document.getElementById('ruleCloseTime');
  const ruleModalAlert = document.getElementById('ruleModalAlert');

  // Prayer Schedules Elements
  const prayerAlertBox = document.getElementById('prayerAlertBox');
  const prayerTableContainer = document.getElementById('prayerTableContainer');
  const prayerScheduleTbody = document.getElementById('prayerScheduleTbody');
  const savePrayerScheduleBtn = document.getElementById('savePrayerScheduleBtn');
  const fillDefaultPrayersBtn = document.getElementById('fillDefaultPrayersBtn');
  const copyPrayerWeekBtn = document.getElementById('copyPrayerWeekBtn');
  const prayerDatePicker = document.getElementById('prayerDatePicker');
  const prayerDateTodayBtn = document.getElementById('prayerDateTodayBtn');
  const prayerDateTomorrowBtn = document.getElementById('prayerDateTomorrowBtn');
  const prayerDateDayAfterBtn = document.getElementById('prayerDateDayAfterBtn');
  const prayerConfigStatusBadge = document.getElementById('prayerConfigStatusBadge');
  const prayerRegionSelect = document.getElementById('prayerRegionSelect');
  const calcDynamicPrayersBtn = document.getElementById('calcDynamicPrayersBtn');
  const syncAutoMonthBtn = document.getElementById('syncAutoMonthBtn');

  // History Elements
  const attendancesTbody = document.getElementById('attendancesTbody');
  const historySearchInput = document.getElementById('historySearchInput');
  const historySessionFilter = document.getElementById('historySessionFilter');
  const historyRoleFilter = document.getElementById('historyRoleFilter');
  const historyStatusFilter = document.getElementById('historyStatusFilter');

  // System & Backup Elements
  const sysDbSize = document.getElementById('sysDbSize');
  const sysLastBackup = document.getElementById('sysLastBackup');
  const sysTotalPersons = document.getElementById('sysTotalPersons');
  const sysTotalAttendances = document.getElementById('sysTotalAttendances');
  const printCardContainer = document.getElementById('printCardContainer');

  let currentTab = 'dashboard';
  let activeSinglePersonForPrint = null;

  // Time conversion helpers
  function timeToMins(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  function minsToTime(mins) {
    const norm = ((mins % 1440) + 1440) % 1440;
    const h = Math.floor(norm / 60);
    const m = norm % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  function getTodayDateStr() {
    const d = new Date();
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return f.format(d);
  }

  function addDaysToStr(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + days);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  globalDateFilter.value = getTodayDateStr();

  // ============================================
  // 1. AUTHENTICATION & SESSION VERIFICATION
  // ============================================
  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();

      if (!data.is_authenticated) {
        window.location.href = '/login';
        return false;
      }

      if (data.user && data.user.username) {
        adminUsername.textContent = data.user.username;
      }
      return true;
    } catch (err) {
      window.location.href = '/login';
      return false;
    }
  }

  logoutBtn.addEventListener('click', async () => {
    if (!confirm('Apakah Anda yakin ingin keluar dari panel admin?')) return;
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    window.location.href = '/login';
  });

  // ============================================
  // 2. ROUTE & TAB NAVIGATION
  // ============================================
  const pathToTabMap = {
    '/admin': 'dashboard',
    '/admin/': 'dashboard',
    '/admin/dashboard': 'dashboard',
    '/admin/persons': 'persons',
    '/admin/productive-schedule': 'productive-rules',
    '/admin/prayer-schedule': 'prayer-rules',
    '/admin/attendance-history': 'attendance-history',
    '/admin/backup': 'system-backup'
  };

  const tabToPathMap = {
    'dashboard': '/admin/dashboard',
    'persons': '/admin/persons',
    'productive-rules': '/admin/productive-schedule',
    'prayer-rules': '/admin/prayer-schedule',
    'attendance-history': '/admin/attendance-history',
    'system-backup': '/admin/backup'
  };

  const tabTitles = {
    dashboard: { h: 'Dashboard Hari Ini', sub: 'Ringkasan kehadiran santri dan pengurus Pondok Teknologi' },
    persons: { h: 'Data Santri & Pengurus', sub: 'Kelola data personil dan cetak kartu QR Code absensi' },
    'productive-rules': { h: 'Jadwal Absensi Produktif', sub: 'Atur batas waktu untuk Masuk Pagi dan Masuk Siang' },
    'prayer-rules': { h: 'Jadwal Absensi Shalat', sub: 'Atur waktu adzan, otomatis menghitung batas Hijau, Kuning, Merah, dan Tutup' },
    'attendance-history': { h: 'Riwayat Catatan Absensi', sub: 'Lihat seluruh log absensi, filter, dan download file CSV' },
    'system-backup': { h: 'Backup Database & Ekspor Data', sub: 'Unduh file cadangan database SQLite dan informasi sistem' }
  };

  const tabToSectionIdMap = {
    'dashboard': 'dashboardTab',
    'persons': 'personsTab',
    'productive-rules': 'productiveRulesTab',
    'prayer-rules': 'prayerRulesTab',
    'attendance-history': 'attendanceHistoryTab',
    'system-backup': 'systemBackupTab'
  };

  function switchTab(tabId, pushState = true) {
    currentTab = tabId;
    navItems.forEach(nav => {
      nav.classList.toggle('active', nav.getAttribute('data-tab') === tabId);
    });

    const targetSectionId = tabToSectionIdMap[tabId] || `${tabId}Tab`;
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === targetSectionId);
    });

    if (tabTitles[tabId]) {
      pageHeading.textContent = tabTitles[tabId].h;
      pageSubheading.textContent = tabTitles[tabId].sub;
    }

    if (pushState && tabToPathMap[tabId]) {
      const targetPath = tabToPathMap[tabId];
      if (window.location.pathname !== targetPath) {
        history.pushState({ tab: tabId }, '', targetPath);
      }
    }

    loadCurrentTabData();
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = item.getAttribute('data-tab');
      switchTab(targetTab, true);
    });
  });

  window.addEventListener('popstate', () => {
    const tab = pathToTabMap[window.location.pathname] || 'dashboard';
    switchTab(tab, false);
  });

  function loadCurrentTabData() {
    const date = globalDateFilter.value;
    if (currentTab === 'dashboard') loadDashboard(date);
    else if (currentTab === 'persons') loadPersons();
    else if (currentTab === 'productive-rules') loadProductiveRules();
    else if (currentTab === 'prayer-rules') loadPrayerSchedules(date);
    else if (currentTab === 'attendance-history') loadAttendances();
    else if (currentTab === 'system-backup') loadSystemInfo();
  }

  globalDateFilter.addEventListener('change', () => {
    loadCurrentTabData();
  });

  refreshDataBtn.addEventListener('click', () => {
    loadCurrentTabData();
  });

  // ============================================
  // 3. DASHBOARD
  // ============================================
  async function loadDashboard(dateStr) {
    try {
      const res = await fetch(`/api/dashboard?date=${dateStr}`);
      if (res.status === 401) { window.location.href = '/login'; return; }
      const data = await res.json();

      statTotalPersons.textContent = data.summary.total_persons;
      statHadir.textContent = data.summary.hadir;
      statTerlambat.textContent = data.summary.terlambat;
      statTerlambatBerat.textContent = data.summary.terlambat_berat;
      statTotalScans.textContent = data.summary.total_scans;

      dashSantriTotal.textContent = data.summary.total_santri;
      dashSantriHadir.textContent = data.role_breakdown.santri.PRESENT;
      dashSantriLate.textContent = data.role_breakdown.santri.LATE;
      dashSantriLateCrit.textContent = data.role_breakdown.santri.LATE_CRITICAL;
      dashSantriSum.textContent = data.role_breakdown.santri.TOTAL;

      dashPengurusTotal.textContent = data.summary.total_pengurus;
      dashPengurusHadir.textContent = data.role_breakdown.pengurus.PRESENT;
      dashPengurusLate.textContent = data.role_breakdown.pengurus.LATE;
      dashPengurusLateCrit.textContent = data.role_breakdown.pengurus.LATE_CRITICAL;
      dashPengurusSum.textContent = data.role_breakdown.pengurus.TOTAL;

      if (data.session_breakdown && data.session_breakdown.length > 0) {
        sessionBreakdownTbody.innerHTML = data.session_breakdown.map(s => `
          <tr>
            <td><strong>${escapeHtml(s.nama_absensi)}</strong></td>
            <td><span class="badge ${s.jenis === 'SHALAT' ? 'badge-blue' : 'badge-purple'}">${s.jenis}</span></td>
            <td>${s.target_time}</td>
            <td>${s.start_scan} - ${s.close_time}</td>
            <td><span class="badge badge-green">${s.hadir}</span></td>
            <td><span class="badge badge-yellow">${s.terlambat}</span></td>
            <td><span class="badge badge-red">${s.terlambat_berat}</span></td>
            <td><strong>${s.total_absen}</strong></td>
            <td><span style="color: #94a3b8;">${s.belum_hadir}</span></td>
          </tr>
        `).join('');
      } else {
        sessionBreakdownTbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Belum ada sesi absensi terdaftar untuk tanggal ini.</td></tr>';
      }

      if (data.recent_scans && data.recent_scans.length > 0) {
        recentScansTbody.innerHTML = data.recent_scans.map(r => {
          let badgeClass = 'badge-gray';
          let statusLabel = r.status;
          if (r.status === 'PRESENT') { badgeClass = 'badge-green'; statusLabel = 'HADIR'; }
          else if (r.status === 'LATE') { badgeClass = 'badge-yellow'; statusLabel = 'TERLAMBAT'; }
          else if (r.status === 'LATE_CRITICAL') { badgeClass = 'badge-red'; statusLabel = 'TERLAMBAT BERAT'; }

          return `
            <tr>
              <td><code>${r.waktu_scan}</code></td>
              <td><strong>${escapeHtml(r.nama)}</strong> <span style="color: #94a3b8; font-size: 12px;">(${escapeHtml(r.nomor_induk)})</span></td>
              <td><span class="badge ${r.tipe_person === 'PENGURUS' ? 'badge-blue' : 'badge-purple'}">${r.tipe_person}</span></td>
              <td>${escapeHtml(r.nama_absensi)}</td>
              <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
            </tr>
          `;
        }).join('');
      } else {
        recentScansTbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Belum ada scan hari ini.</td></tr>';
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  }

  // ============================================
  // 4. DATA ORANG & QR
  // ============================================
  async function loadPersons() {
    const search = personSearchInput.value.trim();
    const tipe = personRoleFilter.value;
    const yayasan = personYayasanFilter ? personYayasanFilter.value : '';
    const status = personStatusFilter.value;

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (tipe) params.append('tipe', tipe);
    if (yayasan) params.append('yayasan', yayasan);
    if (status) params.append('status', status);
    if (personSort.col) {
      params.append('sort_by', personSort.col);
      params.append('sort_order', personSort.order);
    }

    try {
      const res = await fetch(`/api/persons?${params.toString()}`);
      if (res.status === 401) { window.location.href = '/login'; return; }
      let persons = await res.json();

      if (!persons || persons.length === 0) {
        personsTbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Tidak ada data orang yang ditemukan.</td></tr>';
        return;
      }

      // Client-side sort guarantee
      if (personSort.col && Array.isArray(persons)) {
        persons.sort((a, b) => {
          let valA = a[personSort.col] ?? '';
          let valB = b[personSort.col] ?? '';
          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();
          if (valA < valB) return personSort.order === 'ASC' ? -1 : 1;
          if (valA > valB) return personSort.order === 'ASC' ? 1 : -1;
          return 0;
        });
      }

      personsTbody.innerHTML = persons.map(p => `
        <tr>
          <td><code>${escapeHtml(p.nomor_induk)}</code></td>
          <td><strong>${escapeHtml(p.nama)}</strong></td>
          <td><span class="badge ${p.tipe_person === 'PENGURUS' ? 'badge-blue' : 'badge-purple'}">${p.tipe_person}</span></td>
          <td><span class="badge" style="background: rgba(59, 130, 246, 0.1); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.25); font-size: 11px;">${escapeHtml(p.yayasan || 'Pondok Teknologi')}</span></td>
          <td>${escapeHtml(p.jurusan || '-')}</td>
          <td><code>${escapeHtml(p.qr_code)}</code></td>
          <td>
            <button class="badge ${p.status === 'AKTIF' ? 'badge-green' : 'badge-red'} toggle-status-btn" data-id="${p.id}" style="cursor: pointer; border: none;">
              ${p.status}
            </button>
          </td>
          <td style="text-align: right;">
            <button class="btn-secondary view-qr-btn" data-id="${p.id}" style="padding: 5px 10px; font-size: 12px; margin-right: 4px;">
              👁️ QR
            </button>
            <button class="btn-secondary edit-person-btn" data-person='${JSON.stringify(p).replace(/'/g, "&apos;")}' style="padding: 5px 10px; font-size: 12px; margin-right: 4px;">
              ✏️ Edit
            </button>
            <button class="btn-secondary delete-person-btn" data-id="${p.id}" data-nama="${escapeHtml(p.nama)}" data-nomor="${escapeHtml(p.nomor_induk)}" style="padding: 5px 10px; font-size: 12px; color: #f87171; border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08);" title="Hapus data personil ini">
              🗑️ Hapus
            </button>
          </td>
        </tr>
      `).join('');

      document.querySelectorAll('.toggle-status-btn').forEach(b => {
        b.addEventListener('click', async (e) => {
          const id = e.target.getAttribute('data-id');
          await fetch(`/api/persons/${id}/toggle-status`, { method: 'PATCH' });
          loadPersons();
        });
      });

      document.querySelectorAll('.view-qr-btn').forEach(b => {
        b.addEventListener('click', (e) => {
          const id = e.target.getAttribute('data-id');
          showQrModal(id);
        });
      });

      document.querySelectorAll('.edit-person-btn').forEach(b => {
        b.addEventListener('click', (e) => {
          const person = JSON.parse(e.target.getAttribute('data-person'));
          openEditPersonModal(person);
        });
      });

      document.querySelectorAll('.delete-person-btn').forEach(b => {
        b.addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          const id = btn.getAttribute('data-id');
          const nama = btn.getAttribute('data-nama');
          const nomor = btn.getAttribute('data-nomor');

          if (!confirm(`Hapus data ${nama} (${nomor})?\n\nPerhatian: Riwayat absensi terkait orang ini juga akan ikut dihapus.`)) {
            return;
          }

          try {
            const res = await fetch(`/api/persons/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) {
              alert(data.error || 'Gagal menghapus data personil');
              return;
            }
            loadPersons();
            loadDashboard();
          } catch (err) {
            alert('Terjadi kesalahan koneksi saat menghapus data');
          }
        });
      });
    } catch (err) {
      console.error('Failed to load persons:', err);
    }
  }

  function updatePersonSortHeaders() {
    if (!personsTable) return;
    personsTable.querySelectorAll('th.sortable').forEach(th => {
      const col = th.getAttribute('data-sort');
      const indicator = th.querySelector('.sort-indicator');
      th.classList.remove('active-sort');
      if (col === personSort.col) {
        th.classList.add('active-sort');
        if (indicator) indicator.textContent = personSort.order === 'ASC' ? '▲' : '▼';
      } else {
        if (indicator) indicator.textContent = '⇅';
      }
    });
  }

  // Header click listener for interactive sorting
  if (personsTable) {
    personsTable.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (personSort.col === col) {
          personSort.order = personSort.order === 'ASC' ? 'DESC' : 'ASC';
        } else {
          personSort.col = col;
          personSort.order = 'ASC';
        }

        if (personSortFilter) {
          const optVal = `${personSort.col}:${personSort.order}`;
          personSortFilter.value = personSortFilter.querySelector(`option[value="${optVal}"]`) ? optVal : '';
        }

        updatePersonSortHeaders();
        loadPersons();
      });
    });
  }

  if (personSortFilter) {
    personSortFilter.addEventListener('change', () => {
      const val = personSortFilter.value;
      if (val) {
        const [col, order] = val.split(':');
        personSort = { col, order };
      } else {
        personSort = { col: null, order: 'ASC' };
      }
      updatePersonSortHeaders();
      loadPersons();
    });
  }

  personSearchInput.addEventListener('input', debounce(loadPersons, 300));
  if (personYayasanFilter) personYayasanFilter.addEventListener('change', loadPersons);
  personRoleFilter.addEventListener('change', loadPersons);
  personStatusFilter.addEventListener('change', loadPersons);

  addPersonBtn.addEventListener('click', () => {
    personModalTitle.textContent = 'Tambah Orang Baru';
    personFormId.value = '';
    personNomorInduk.value = '';
    personNama.value = '';
    personTipe.value = 'SANTRI';
    if (personYayasan) personYayasan.value = 'Pondok Teknologi';
    personJurusan.value = '';
    personQrCode.value = '';
    personStatus.value = 'AKTIF';
    if (deletePersonModalBtn) deletePersonModalBtn.style.display = 'none';
    openModal(personModal);
  });

  function openEditPersonModal(p) {
    personModalTitle.textContent = 'Edit Data Orang';
    personFormId.value = p.id;
    personNomorInduk.value = p.nomor_induk;
    personNama.value = p.nama;
    personTipe.value = p.tipe_person;
    if (personYayasan) personYayasan.value = p.yayasan || 'Pondok Teknologi';
    personJurusan.value = p.jurusan || '';
    personQrCode.value = p.qr_code;
    personStatus.value = p.status;
    if (deletePersonModalBtn) {
      deletePersonModalBtn.style.display = 'inline-block';
      deletePersonModalBtn.setAttribute('data-id', p.id);
      deletePersonModalBtn.setAttribute('data-nama', p.nama);
      deletePersonModalBtn.setAttribute('data-nomor', p.nomor_induk);
    }
    openModal(personModal);
  }

  if (deletePersonModalBtn) {
    deletePersonModalBtn.addEventListener('click', async () => {
      const id = deletePersonModalBtn.getAttribute('data-id');
      const nama = deletePersonModalBtn.getAttribute('data-nama');
      const nomor = deletePersonModalBtn.getAttribute('data-nomor');

      if (!confirm(`Hapus data ${nama} (${nomor})?\n\nPerhatian: Riwayat absensi terkait orang ini juga akan ikut dihapus.`)) {
        return;
      }

      try {
        const res = await fetch(`/api/persons/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'Gagal menghapus data personil');
          return;
        }
        closeModal(personModal);
        loadPersons();
        loadDashboard();
      } catch (err) {
        alert('Terjadi kesalahan koneksi saat menghapus data');
      }
    });
  }

  personForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = personFormId.value;
    const payload = {
      nomor_induk: personNomorInduk.value.trim(),
      nama: personNama.value.trim(),
      tipe_person: personTipe.value,
      yayasan: personYayasan ? personYayasan.value : 'Pondok Teknologi',
      jurusan: personJurusan.value.trim(),
      qr_code: personQrCode.value.trim(),
      status: personStatus.value
    };

    try {
      const url = id ? `/api/persons/${id}` : '/api/persons';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Terjadi kesalahan saat menyimpan data');
        return;
      }
      closeModal(personModal);
      loadPersons();
    } catch (err) {
      alert('Gagal menyimpan data');
    }
  });

  async function showQrModal(id) {
    try {
      const res = await fetch(`/api/persons/${id}/qr`);
      const data = await res.json();
      activeSinglePersonForPrint = data;

      qrModalImage.src = data.qr_image;
      qrModalName.textContent = data.person.nama;
      qrModalMeta.textContent = `${data.person.nomor_induk} - ${data.person.tipe_person} (${data.person.jurusan || '-'})`;
      qrModalCode.textContent = data.person.qr_code;

      openModal(qrModal);
    } catch (err) {
      alert('Gagal memuat QR Code');
    }
  }

  printSingleQrBtn.addEventListener('click', () => {
    if (!activeSinglePersonForPrint) return;
    const p = activeSinglePersonForPrint.person;
    printCardContainer.innerHTML = `
      <div class="id-card-print">
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px;">
          <img src="/images/logo.png" alt="Logo" style="width: 28px; height: 28px; object-fit: contain;">
          <div class="org-header" style="margin: 0; font-size: 13px; font-weight: 800; color: #1e3a8a;">PONDOK TEKNOLOGI</div>
        </div>
        <div class="org-sub">KARTU ABSENSI RESMI</div>
        <img src="${activeSinglePersonForPrint.qr_image}" alt="QR">
        <div class="card-name">${escapeHtml(p.nama)}</div>
        <div class="card-id">${escapeHtml(p.nomor_induk)} | ${escapeHtml(p.jurusan || '')}</div>
        <span class="card-badge">${p.tipe_person}</span>
      </div>
    `;
    window.print();
  });

  batchPrintQrBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/persons-qr-all');
      const cards = await res.json();

      if (!cards || cards.length === 0) {
        alert('Tidak ada data orang aktif untuk dicetak');
        return;
      }

      printCardContainer.innerHTML = cards.map(c => `
        <div class="id-card-print">
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px;">
            <img src="/images/logo.png" alt="Logo" style="width: 28px; height: 28px; object-fit: contain;">
            <div class="org-header" style="margin: 0; font-size: 13px; font-weight: 800; color: #1e3a8a;">PONDOK TEKNOLOGI</div>
          </div>
          <div class="org-sub">KARTU ABSENSI RESMI</div>
          <img src="${c.qr_image}" alt="QR">
          <div class="card-name">${escapeHtml(c.nama)}</div>
          <div class="card-id">${escapeHtml(c.nomor_induk)} | ${escapeHtml(c.jurusan || '')}</div>
          <span class="card-badge">${c.tipe_person}</span>
        </div>
      `).join('');

      window.print();
    } catch (err) {
      alert('Gagal memuat kartu cetak batch');
    }
  });

  // ============================================
  // 5. JADWAL ABSENSI PRODUKTIF
  // ============================================
  async function loadProductiveRules() {
    try {
      const res = await fetch('/api/rules');
      if (res.status === 401) { window.location.href = '/login'; return; }
      const rules = await res.json();

      // Render cards
      productiveCardsContainer.innerHTML = rules.map(r => {
        const mStart = timeToMins(r.start_scan);
        const mYellow = timeToMins(r.yellow_start);
        const mRed = timeToMins(r.red_start);
        const mClose = timeToMins(r.close_time);

        const greenEnd = minsToTime(mYellow - 1);
        const yellowEnd = minsToTime(mRed - 1);
        const redEnd = minsToTime(mClose - 1);

        return `
          <div class="rule-card-item">
            <div class="rule-card-top">
              <div>
                <div class="rule-card-title">${escapeHtml(r.nama_absensi)}</div>
                <span style="font-size: 12px; color: #94a3b8;">Sesi Produktif</span>
              </div>
              <span class="rule-target-badge">Target: ${r.target_time}</span>
            </div>

            <div class="rule-windows-list">
              <div class="rule-window-row">
                <span class="rule-window-label">Mulai Scan</span>
                <span class="rule-window-val">${r.start_scan}</span>
              </div>
              <div class="rule-window-row" style="color: #34d399;">
                <span class="rule-window-label">🟢 Hijau (Hadir)</span>
                <span class="rule-window-val">${r.start_scan} - ${greenEnd}</span>
              </div>
              <div class="rule-window-row" style="color: #fbbf24;">
                <span class="rule-window-label">🟡 Kuning (Terlambat)</span>
                <span class="rule-window-val">${r.yellow_start} - ${yellowEnd}</span>
              </div>
              <div class="rule-window-row" style="color: #f87171;">
                <span class="rule-window-label">🔴 Merah (Terlambat Berat)</span>
                <span class="rule-window-val">${r.red_start} - ${redEnd}</span>
              </div>
              <div class="rule-window-row" style="color: #94a3b8;">
                <span class="rule-window-label">🚫 Ditutup</span>
                <span class="rule-window-val">${r.close_time} dst</span>
              </div>
            </div>

            <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
              <button class="btn-primary edit-rule-card-btn" data-rule='${JSON.stringify(r).replace(/'/g, "&apos;")}' style="padding: 7px 16px; font-size: 13px;">
                ✏️ Ubah Jam ${escapeHtml(r.nama_absensi)}
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Render table
      productiveRulesTbody.innerHTML = rules.map(r => `
        <tr>
          <td><strong>${escapeHtml(r.nama_absensi)}</strong></td>
          <td><span class="badge badge-green">${r.start_scan}</span></td>
          <td><strong>${r.target_time}</strong></td>
          <td><span class="badge badge-yellow">${r.yellow_start}</span></td>
          <td><span class="badge badge-red">${r.red_start}</span></td>
          <td><span class="badge badge-gray">${r.close_time}</span></td>
          <td><span class="badge ${r.active ? 'badge-green' : 'badge-red'}">${r.active ? 'AKTIF' : 'NONAKTIF'}</span></td>
          <td style="text-align: right;">
            <button class="btn-secondary edit-rule-btn" data-rule='${JSON.stringify(r).replace(/'/g, "&apos;")}' style="padding: 5px 12px; font-size: 13px;">
              ✏️ Ubah Jam
            </button>
          </td>
        </tr>
      `).join('');

      document.querySelectorAll('.edit-rule-btn, .edit-rule-card-btn').forEach(b => {
        b.addEventListener('click', (e) => {
          const rule = JSON.parse(e.currentTarget.getAttribute('data-rule'));
          openEditRuleModal(rule);
        });
      });
    } catch (err) {
      console.error('Failed to load productive rules:', err);
    }
  }

  function openEditRuleModal(rule) {
    ruleModalAlert.style.display = 'none';
    ruleFormId.value = rule.id;
    ruleNamaAbsensi.value = rule.nama_absensi;
    ruleStartScan.value = rule.start_scan;
    ruleTargetTime.value = rule.target_time;
    ruleYellowStart.value = rule.yellow_start;
    ruleRedStart.value = rule.red_start;
    ruleCloseTime.value = rule.close_time;
    openModal(ruleModal);
  }

  ruleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    ruleModalAlert.style.display = 'none';

    const id = ruleFormId.value;
    const payload = {
      nama_absensi: ruleNamaAbsensi.value.trim(),
      start_scan: ruleStartScan.value,
      target_time: ruleTargetTime.value,
      yellow_start: ruleYellowStart.value,
      red_start: ruleRedStart.value,
      close_time: ruleCloseTime.value,
      active: 1
    };

    try {
      const res = await fetch(`/api/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        ruleModalAlert.textContent = data.error || 'Gagal mengubah jam';
        ruleModalAlert.style.display = 'block';
        return;
      }
      closeModal(ruleModal);
      loadProductiveRules();
    } catch (err) {
      ruleModalAlert.textContent = 'Terjadi kesalahan sistem';
      ruleModalAlert.style.display = 'block';
    }
  });

  // ============================================
  // 6. JADWAL SHALAT (With Empty State & Validation)
  // ============================================
  // 6. JADWAL SHALAT (Kustomisasi Waktu Adzan Kapan Saja)
  // ============================================
  const standardPrayerDefaults = [
    { prayer_type: 'SUBUH', nama_absensi: 'Shalat Subuh', icon: '🌅', adhan_time: '04:20' },
    { prayer_type: 'DZUHUR', nama_absensi: 'Shalat Dzuhur', icon: '☀️', adhan_time: '11:45' },
    { prayer_type: 'ASHAR', nama_absensi: 'Shalat Ashar', icon: '🌤️', adhan_time: '15:00' },
    { prayer_type: 'MAGHRIB', nama_absensi: 'Shalat Maghrib', icon: '🌇', adhan_time: '17:45' },
    { prayer_type: 'ISYA', nama_absensi: 'Shalat Isya', icon: '🌙', adhan_time: '18:55' }
  ];

  function showPrayerAlert(msg, type = 'info') {
    prayerAlertBox.textContent = msg;
    prayerAlertBox.className = `alert-box ${type}`;
    prayerAlertBox.style.display = 'flex';
  }

  function hidePrayerAlert() {
    prayerAlertBox.style.display = 'none';
  }

  async function fetchCalculatedPrayers(dateStr, regionKey) {
    try {
      const reg = regionKey || (prayerRegionSelect ? prayerRegionSelect.value : 'YOGYAKARTA');
      const res = await fetch(`/api/prayer-schedules/calculate?tanggal=${dateStr}&region=${reg}`);
      const json = await res.json();
      if (json.success && json.data) {
        return [
          { prayer_type: 'SUBUH', nama_absensi: 'Shalat Subuh', icon: '🌅', adhan_time: json.data.SUBUH },
          { prayer_type: 'DZUHUR', nama_absensi: 'Shalat Dzuhur', icon: '☀️', adhan_time: json.data.DZUHUR },
          { prayer_type: 'ASHAR', nama_absensi: 'Shalat Ashar', icon: '🌤️', adhan_time: json.data.ASHAR },
          { prayer_type: 'MAGHRIB', nama_absensi: 'Shalat Maghrib', icon: '🌇', adhan_time: json.data.MAGHRIB },
          { prayer_type: 'ISYA', nama_absensi: 'Shalat Isya', icon: '🌙', adhan_time: json.data.ISYA }
        ];
      }
    } catch (e) {
      console.warn('Failed to calculate dynamic prayers:', e);
    }
    return standardPrayerDefaults;
  }

  async function loadPrayerSchedules(dateStr) {
    hidePrayerAlert();
    const activeDate = dateStr || prayerDatePicker.value || globalDateFilter.value || getTodayDateStr();
    prayerDatePicker.value = activeDate;
    globalDateFilter.value = activeDate;

    try {
      const res = await fetch(`/api/prayer-schedules?date=${activeDate}`);
      if (res.status === 401) { window.location.href = '/login'; return; }
      const data = await res.json();

      if (data.is_configured && data.schedules && data.schedules.length > 0) {
        prayerConfigStatusBadge.innerHTML = `
          <span class="badge badge-green" style="font-size: 13px; font-weight: 700; padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px;">
            <span>✅</span> Jadwal Tanggal ${formatDisplayDate(activeDate)} Aktif Tersimpan di Database
          </span>
        `;
        renderPrayerTableRows(data.schedules);
      } else {
        const dynamicPrayers = await fetchCalculatedPrayers(activeDate, prayerRegionSelect ? prayerRegionSelect.value : 'YOGYAKARTA');
        const regName = prayerRegionSelect ? prayerRegionSelect.options[prayerRegionSelect.selectedIndex].text : 'Yogyakarta';
        prayerConfigStatusBadge.innerHTML = `
          <span class="badge badge-yellow" style="font-size: 13px; font-weight: 700; padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px;">
            <span>📍</span> Tanggal ${formatDisplayDate(activeDate)} Dihitung Otomatis (${regName}). Sesuaikan jam lalu klik Simpan.
          </span>
        `;
        renderPrayerTableRows(dynamicPrayers);
      }
    } catch (err) {
      console.error('Failed to load prayer schedules:', err);
      showPrayerAlert('Gagal memuat jadwal dari server', 'error');
    }
  }

  function renderPrayerTableRows(schedules) {
    const prayerIcons = {
      'SUBUH': '🌅',
      'DZUHUR': '☀️',
      'ASHAR': '🌤️',
      'MAGHRIB': '🌇',
      'ISYA': '🌙'
    };

    prayerScheduleTbody.innerHTML = schedules.map(p => {
      const pType = p.prayer_type.toUpperCase();
      const icon = prayerIcons[pType] || '🕌';
      const adhanMins = timeToMins(p.adhan_time);
      const startScan = minsToTime(adhanMins - 10);
      const greenWindow = `${startScan} - ${minsToTime(adhanMins - 1)}`;
      const yellowWindow = `${p.adhan_time} - ${minsToTime(adhanMins + 9)}`;
      const redWindow = `${minsToTime(adhanMins + 10)} - ${minsToTime(adhanMins + 39)}`;
      const closeWindow = `${minsToTime(adhanMins + 40)} dst`;

      return `
        <tr data-type="${pType}">
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">${icon}</span>
              <div>
                <strong>${escapeHtml(p.nama_absensi || ('Shalat ' + pType.charAt(0) + pType.slice(1).toLowerCase()))}</strong>
              </div>
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button type="button" class="btn-secondary btn-time-minus" style="padding: 4px 8px; font-size: 11px; font-weight: 700;" title="Kurangi 5 menit">-5m</button>
              <input type="time" class="input-text adhan-time-input" value="${p.adhan_time}" style="width: 105px; font-weight: 700; text-align: center; font-size: 14px;">
              <button type="button" class="btn-secondary btn-time-plus" style="padding: 4px 8px; font-size: 11px; font-weight: 700;" title="Tambah 5 menit">+5m</button>
            </div>
          </td>
          <td class="col-start-scan"><code>${startScan}</code></td>
          <td class="col-green"><span class="badge badge-green">${greenWindow}</span></td>
          <td class="col-yellow"><span class="badge badge-yellow">${yellowWindow}</span></td>
          <td class="col-red"><span class="badge badge-red">${redWindow}</span></td>
          <td class="col-close"><span class="badge badge-gray">${closeWindow}</span></td>
        </tr>
      `;
    }).join('');

    // Attach listeners for time changes and quick -5m/+5m adjustment
    prayerScheduleTbody.querySelectorAll('tr').forEach(row => {
      const input = row.querySelector('.adhan-time-input');
      const minusBtn = row.querySelector('.btn-time-minus');
      const plusBtn = row.querySelector('.btn-time-plus');

      function updateRowWindows(newTimeStr) {
        if (!newTimeStr || newTimeStr.length !== 5) return;
        const adhanMins = timeToMins(newTimeStr);
        const startScan = minsToTime(adhanMins - 10);
        const greenWindow = `${startScan} - ${minsToTime(adhanMins - 1)}`;
        const yellowWindow = `${newTimeStr} - ${minsToTime(adhanMins + 9)}`;
        const redWindow = `${minsToTime(adhanMins + 10)} - ${minsToTime(adhanMins + 39)}`;
        const closeWindow = `${minsToTime(adhanMins + 40)} dst`;

        row.querySelector('.col-start-scan code').textContent = startScan;
        row.querySelector('.col-green span').textContent = greenWindow;
        row.querySelector('.col-yellow span').textContent = yellowWindow;
        row.querySelector('.col-red span').textContent = redWindow;
        row.querySelector('.col-close span').textContent = closeWindow;
      }

      input.addEventListener('input', (e) => {
        updateRowWindows(e.target.value);
      });

      minusBtn.addEventListener('click', () => {
        const curMins = timeToMins(input.value);
        const newMins = Math.max(0, curMins - 5);
        input.value = minsToTime(newMins);
        updateRowWindows(input.value);
      });

      plusBtn.addEventListener('click', () => {
        const curMins = timeToMins(input.value);
        const newMins = Math.min(1439, curMins + 5);
        input.value = minsToTime(newMins);
        updateRowWindows(input.value);
      });
    });
  }

  // Collect schedule form data
  function collectPrayerScheduleData() {
    const rows = prayerScheduleTbody.querySelectorAll('tr');
    const schedules = [];
    rows.forEach(r => {
      const pType = r.getAttribute('data-type');
      const input = r.querySelector('.adhan-time-input');
      if (pType && input && input.value) {
        schedules.push({
          prayer_type: pType,
          adhan_time: input.value
        });
      }
    });
    return schedules;
  }

  // Action: Save prayer schedule for selected date
  savePrayerScheduleBtn.addEventListener('click', async () => {
    hidePrayerAlert();
    const dateStr = prayerDatePicker.value || globalDateFilter.value;
    const schedules = collectPrayerScheduleData();

    if (schedules.length < 5) {
      showPrayerAlert('Harap isi lengkap waktu adzan untuk ke-5 waktu shalat (Subuh, Dzuhur, Ashar, Maghrib, Isya)', 'error');
      return;
    }

    try {
      const res = await fetch('/api/prayer-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tanggal: dateStr, schedules })
      });
      const data = await res.json();
      if (!res.ok) {
        showPrayerAlert(data.error || 'Gagal menyimpan jadwal adzan', 'error');
        return;
      }
      showPrayerAlert(`✅ Jadwal adzan shalat untuk tanggal ${formatDisplayDate(dateStr)} berhasil disimpan ke database!`, 'success');
      loadPrayerSchedules(dateStr);
    } catch (err) {
      showPrayerAlert('Terjadi kesalahan koneksi server saat menyimpan jadwal', 'error');
    }
  });

  // Action: Copy prayer schedule to 7 days
  copyPrayerWeekBtn.addEventListener('click', async () => {
    hidePrayerAlert();
    const dateStr = prayerDatePicker.value || globalDateFilter.value;
    const schedules = collectPrayerScheduleData();

    if (schedules.length < 5) {
      showPrayerAlert('Harap lengkapi waktu adzan untuk ke-5 shalat sebelum menyalin', 'error');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menerapkan waktu shalat ini untuk tanggal ${formatDisplayDate(dateStr)} dan 7 hari ke depan?`)) {
      return;
    }

    try {
      const res = await fetch('/api/prayer-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tanggal: dateStr, schedules, copy_days: 7 })
      });
      const data = await res.json();
      if (!res.ok) {
        showPrayerAlert(data.error || 'Gagal menyalin jadwal', 'error');
        return;
      }
      showPrayerAlert(`✅ ${data.message || 'Jadwal berhasil diterapkan untuk 7 hari ke depan!'}`, 'success');
      loadPrayerSchedules(dateStr);
    } catch (err) {
      showPrayerAlert('Terjadi kesalahan saat menyalin jadwal', 'error');
    }
  });

  // Action: Hitung Waktu Jogja Otomatis (Astronomis Kemenag)
  if (calcDynamicPrayersBtn) {
    calcDynamicPrayersBtn.addEventListener('click', async () => {
      const activeDate = prayerDatePicker.value || globalDateFilter.value || getTodayDateStr();
      const reg = prayerRegionSelect ? prayerRegionSelect.value : 'YOGYAKARTA';
      const dynamicRows = await fetchCalculatedPrayers(activeDate, reg);
      renderPrayerTableRows(dynamicRows);
      const regText = prayerRegionSelect ? prayerRegionSelect.options[prayerRegionSelect.selectedIndex].text : 'Yogyakarta';
      showPrayerAlert(`📍 Waktu adzan astronomis untuk ${regText} pada ${formatDisplayDate(activeDate)} berhasil dihitung! Klik "Simpan Tanggal Ini" untuk menyimpannya ke database.`, 'info');
    });
  }

  // Action: Generate & Simpan Otomatis 30 Hari ke Depan
  if (syncAutoMonthBtn) {
    syncAutoMonthBtn.addEventListener('click', async () => {
      hidePrayerAlert();
      const activeDate = prayerDatePicker.value || globalDateFilter.value || getTodayDateStr();
      const reg = prayerRegionSelect ? prayerRegionSelect.value : 'YOGYAKARTA';
      const regText = prayerRegionSelect ? prayerRegionSelect.options[prayerRegionSelect.selectedIndex].text : 'Yogyakarta';

      if (!confirm(`Generate dan simpan otomatis seluruh waktu shalat selama 30 hari ke depan untuk ${regText} mulai tanggal ${formatDisplayDate(activeDate)}?`)) {
        return;
      }

      try {
        const res = await fetch('/api/prayer-schedules/sync-range', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_date: activeDate, days: 30, region: reg })
        });
        const data = await res.json();
        if (!res.ok) {
          showPrayerAlert(data.error || 'Gagal generate jadwal otomatis', 'error');
          return;
        }
        showPrayerAlert(`✅ ${data.message || 'Jadwal 30 hari berhasil digenerate dan disimpan ke database!'}`, 'success');
        loadPrayerSchedules(activeDate);
      } catch (err) {
        showPrayerAlert('Terjadi kesalahan saat generate jadwal otomatis', 'error');
      }
    });
  }

  // Listener ganti wilayah Jogja
  if (prayerRegionSelect) {
    prayerRegionSelect.addEventListener('change', async () => {
      const activeDate = prayerDatePicker.value || globalDateFilter.value || getTodayDateStr();
      const res = await fetch(`/api/prayer-schedules?date=${activeDate}`);
      const data = await res.json();
      if (!data.is_configured) {
        const dynamicRows = await fetchCalculatedPrayers(activeDate, prayerRegionSelect.value);
        renderPrayerTableRows(dynamicRows);
      }
    });
  }

  // Action: Reset / Apply standard defaults
  if (fillDefaultPrayersBtn) {
    fillDefaultPrayersBtn.addEventListener('click', () => {
      renderPrayerTableRows(standardPrayerDefaults);
      showPrayerAlert('Waktu adzan standar telah dimuat pada form. Silakan klik "Simpan Tanggal Ini" untuk menyimpannya ke database.', 'info');
    });
  }

  // Date Navigation Listeners
  prayerDateTodayBtn.addEventListener('click', () => {
    loadPrayerSchedules(getTodayDateStr());
  });

  prayerDateTomorrowBtn.addEventListener('click', () => {
    loadPrayerSchedules(addDaysToStr(getTodayDateStr(), 1));
  });

  prayerDateDayAfterBtn.addEventListener('click', () => {
    loadPrayerSchedules(addDaysToStr(getTodayDateStr(), 2));
  });

  prayerDatePicker.addEventListener('change', (e) => {
    if (e.target.value) {
      loadPrayerSchedules(e.target.value);
    }
  });

  // ============================================
  // 7. RIWAYAT ABSENSI
  // ============================================
  async function loadAttendances() {
    const tanggal = globalDateFilter.value;
    const nama = historySearchInput.value.trim();
    const session_code = historySessionFilter.value;
    const tipe_person = historyRoleFilter.value;
    const status = historyStatusFilter.value;

    const params = new URLSearchParams();
    if (tanggal) params.append('tanggal', tanggal);
    if (nama) params.append('nama', nama);
    if (session_code) params.append('session_code', session_code);
    if (tipe_person) params.append('tipe_person', tipe_person);
    if (status) params.append('status', status);
    if (attendanceSort.col) {
      params.append('sort_by', attendanceSort.col);
      params.append('sort_order', attendanceSort.order);
    }

    try {
      const res = await fetch(`/api/attendances?${params.toString()}`);
      if (res.status === 401) { window.location.href = '/login'; return; }
      let attendances = await res.json();

      if (attendanceSort.col && Array.isArray(attendances)) {
        attendances.sort((a, b) => {
          let valA = a[attendanceSort.col] ?? '';
          let valB = b[attendanceSort.col] ?? '';
          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();
          if (valA < valB) return attendanceSort.order === 'ASC' ? -1 : 1;
          if (valA > valB) return attendanceSort.order === 'ASC' ? 1 : -1;
          return 0;
        });
      }

      if (!attendances || attendances.length === 0) {
        attendancesTbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 30px; color: #94a3b8;">
              Tidak ada catatan absensi untuk filter ini pada tanggal ${formatDisplayDate(tanggal)}.
            </td>
          </tr>
        `;
        return;
      }

      attendancesTbody.innerHTML = attendances.map(a => {
        let badgeClass = 'badge-gray';
        let statusLabel = a.status;
        if (a.status === 'PRESENT') { badgeClass = 'badge-green'; statusLabel = 'HADIR'; }
        else if (a.status === 'LATE') { badgeClass = 'badge-yellow'; statusLabel = 'TERLAMBAT'; }
        else if (a.status === 'LATE_CRITICAL') { badgeClass = 'badge-red'; statusLabel = 'TERLAMBAT BERAT'; }

        return `
          <tr>
            <td>${a.tanggal}</td>
            <td><code>${a.waktu_scan}</code></td>
            <td><strong>${escapeHtml(a.nama)}</strong> <span style="color: #94a3b8; font-size: 12px;">(${escapeHtml(a.nomor_induk)})</span></td>
            <td><span class="badge ${a.tipe_person === 'PENGURUS' ? 'badge-blue' : 'badge-purple'}">${a.tipe_person}</span></td>
            <td>${escapeHtml(a.nama_absensi)}</td>
            <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
            <td style="text-align: right;">
              <button class="btn-secondary delete-att-btn" data-id="${a.id}" style="padding: 4px 8px; font-size: 11px; color: #f87171;">
                🗑️ Hapus
              </button>
            </td>
          </tr>
        `;
      }).join('');

      document.querySelectorAll('.delete-att-btn').forEach(b => {
        b.addEventListener('click', async (e) => {
          if (!confirm('Apakah Anda yakin ingin menghapus catatan absensi ini?')) return;
          const id = e.target.getAttribute('data-id');
          await fetch(`/api/attendances/${id}`, { method: 'DELETE' });
          loadAttendances();
        });
      });
    } catch (err) {
      console.error('Failed to load attendances:', err);
    }
  }

  // Attendances Elements & Sorting
  const attendancesTable = document.getElementById('attendancesTable');
  const historySortFilter = document.getElementById('historySortFilter');
  let attendanceSort = { col: null, order: 'DESC' };

  function updateAttendanceSortHeaders() {
    if (!attendancesTable) return;
    attendancesTable.querySelectorAll('th.sortable').forEach(th => {
      const col = th.getAttribute('data-sort');
      const indicator = th.querySelector('.sort-indicator');
      th.classList.remove('active-sort');
      if (col === attendanceSort.col) {
        th.classList.add('active-sort');
        if (indicator) indicator.textContent = attendanceSort.order === 'ASC' ? '▲' : '▼';
      } else {
        if (indicator) indicator.textContent = '⇅';
      }
    });
  }

  if (attendancesTable) {
    attendancesTable.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (attendanceSort.col === col) {
          attendanceSort.order = attendanceSort.order === 'ASC' ? 'DESC' : 'ASC';
        } else {
          attendanceSort.col = col;
          attendanceSort.order = (col === 'tanggal' || col === 'waktu_scan') ? 'DESC' : 'ASC';
        }

        if (historySortFilter) {
          const optVal = `${attendanceSort.col}:${attendanceSort.order}`;
          historySortFilter.value = historySortFilter.querySelector(`option[value="${optVal}"]`) ? optVal : '';
        }

        updateAttendanceSortHeaders();
        loadAttendances();
      });
    });
  }

  if (historySortFilter) {
    historySortFilter.addEventListener('change', () => {
      const val = historySortFilter.value;
      if (val) {
        const [col, order] = val.split(':');
        attendanceSort = { col, order };
      } else {
        attendanceSort = { col: null, order: 'DESC' };
      }
      updateAttendanceSortHeaders();
      loadAttendances();
    });
  }

  historySearchInput.addEventListener('input', debounce(loadAttendances, 300));
  historySessionFilter.addEventListener('change', loadAttendances);
  historyRoleFilter.addEventListener('change', loadAttendances);
  historyStatusFilter.addEventListener('change', loadAttendances);

  // ============================================
  // 8. BACKUP DATABASE & SYSTEM INFO
  // ============================================
  async function loadSystemInfo() {
    try {
      const res = await fetch('/api/system/info');
      if (res.status === 401) { window.location.href = '/login'; return; }
      const data = await res.json();

      sysDbSize.textContent = data.db_size_formatted || '0 B';
      sysTotalPersons.textContent = data.total_active_persons || data.total_persons || '0';
      sysTotalAttendances.textContent = data.total_attendances || '0';

      if (data.last_backup) {
        sysLastBackup.textContent = data.last_backup;
        sysLastBackup.style.color = '#34d399';
      } else {
        sysLastBackup.textContent = 'Belum pernah dicadangkan';
        sysLastBackup.style.color = '#fbbf24';
      }
    } catch (err) {
      console.error('Failed to load system info:', err);
    }
  }

  // ============================================
  // Modal Utilities
  // ============================================
  function openModal(modal) {
    modal.classList.add('active');
  }

  function closeModal(modal) {
    modal.classList.remove('active');
  }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      const modal = document.getElementById(modalId);
      if (modal) closeModal(modal);
    });
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal(e.target);
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function debounce(fn, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // ============================================
  // Initial Boot
  // ============================================
  checkAuth().then(isAuth => {
    if (!isAuth) return;

    // Detect initial tab from URL
    const initialTab = pathToTabMap[window.location.pathname] || 'dashboard';
    switchTab(initialTab, false);
  });

})();
