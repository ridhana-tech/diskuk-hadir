// ==================== STATE VARIABLES ====================
var currentUser = null;
var currentLat = null;
var currentLng = null;
var map = null;
var userMarker = null;
var kantorCircle = null;
var appConfig = null;
var capturedBase64 = null;
var mediaStream = null;
var activeTab = 'beranda';
var todayPresensiStatus = { hasMasuk: false, hasPulang: false };
var selectedUploadMonth = null;
var rawLogsData = [];
var currentFilterType = '1bulan';

var namaBulanIndo = [
  "Januari", "Februari", "Maret", "April",
  "Mei", "Juni", "Juli", "Agustus",
  "September", "Oktober", "November", "Desember"
];

var SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
var lokasiPegawaiValid = false;
var sedangMemintaLokasi = false;


// ==================== INITIALIZATION ====================
window.addEventListener('load', async function() {
  var user = typeof getCurrentSessionUser === 'function'
    ? getCurrentSessionUser()
    : null;

  if (!user || !user.token) {
    if (typeof clearLocalSession === 'function') {
      clearLocalSession();
    }

    currentUser = null;
    showLoginPage();
    return;
  }

  currentUser = user;

  var role = String(currentUser.role || '')
    .trim()
    .toUpperCase();

  if (role === 'ATASAN') {
    window.location.replace('atasan/atasan.html');
    return;
  }

  if (role === 'ADMIN') {
    window.location.replace('admin/admin.html');
    return;
  }

  if (role !== 'PEGAWAI') {
    if (typeof clearLocalSession === 'function') {
      clearLocalSession();
    }

    currentUser = null;
    showLoginPage();
    return;
  }

  var pageLogin = document.getElementById('pageLogin');
  var pagePegawai = document.getElementById('pagePegawai');

  if (pageLogin) pageLogin.classList.add('hidden');
  if (pagePegawai) pagePegawai.classList.remove('hidden');

  await initAppWithUser(currentUser);
});


// ==================== LOCATION GATE ====================
function tampilkanLocationGate(pesan) {
  lokasiPegawaiValid = false;

  var gate = document.getElementById('locationGate');
  var message = document.getElementById('locationGateMessage');

  if (message) message.textContent = pesan;
  if (gate) gate.classList.remove('hidden');

  var berandaLokasi = document.getElementById('berandaLokasi');
  var statusLokasi = document.getElementById('statusLokasi');
  var radiusBadge = document.getElementById('radiusBadge');

  if (berandaLokasi) {
    berandaLokasi.textContent = 'Lokasi belum tersedia';
  }

  if (statusLokasi) {
    statusLokasi.textContent = 'Izin lokasi wajib diberikan';
  }

  if (radiusBadge) {
    radiusBadge.textContent = 'Belum valid';
    radiusBadge.className =
      'text-[9px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-700';
  }
}


function mintaLokasiPegawai() {
  if (sedangMemintaLokasi) return;

  if (!navigator.geolocation) {
    tampilkanLocationGate(
      'Browser ini tidak mendukung GPS. Silakan gunakan browser yang mendukung lokasi.'
    );
    return;
  }

  if (!window.isSecureContext) {
    tampilkanLocationGate(
      'Akses lokasi memerlukan koneksi HTTPS. Buka aplikasi melalui alamat HTTPS.'
    );
    return;
  }

  sedangMemintaLokasi = true;

  var btn = document.getElementById('btnRetryLocation');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Mendeteksi lokasi...';
  }

  var statusLokasi = document.getElementById('statusLokasi');

  if (statusLokasi) {
    statusLokasi.textContent = 'Sedang meminta koordinat GPS...';
  }

  navigator.geolocation.getCurrentPosition(
    async function(position) {
      currentLat = position.coords.latitude;
      currentLng = position.coords.longitude;
      lokasiPegawaiValid = true;
      sedangMemintaLokasi = false;

      var akurasi = Math.round(position.coords.accuracy);

      var berandaLokasi = document.getElementById('berandaLokasi');
      var status = document.getElementById('statusLokasi');
      var badge = document.getElementById('radiusBadge');
      var gate = document.getElementById('locationGate');
      var retryButton = document.getElementById('btnRetryLocation');

      if (berandaLokasi) {
        berandaLokasi.textContent = 'Mencari alamat lokasi...';
      }

      if (status) {
        status.textContent =
          'GPS aktif • Akurasi sekitar ' + akurasi + ' meter';
      }

      if (badge) {
        badge.textContent = 'GPS Aktif';
        badge.className =
          'text-[9px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700';
      }

      if (gate) gate.classList.add('hidden');

      if (retryButton) {
        retryButton.disabled = false;
        retryButton.innerHTML =
          '<i class="fa-solid fa-location-crosshairs mr-2"></i>Aktifkan / Coba Lagi';
      }

      if (typeof map !== 'undefined' && map !== null) {
        map.invalidateSize();
        map.setView([currentLat, currentLng], 17);
      }

      try {
        var alamat = await konversiKoordinatKeAlamat(
          currentLat,
          currentLng
        );

        if (berandaLokasi) {
          berandaLokasi.textContent = alamat;
        }

        if (status) {
          status.textContent =
            'Alamat berhasil ditemukan • Akurasi GPS sekitar ' +
            akurasi + ' meter';
        }
      } catch (error) {
        console.error('Gagal mendapatkan alamat:', error);

        if (berandaLokasi) {
          berandaLokasi.textContent =
            'Alamat belum dapat ditampilkan';
        }

        if (status) {
          status.textContent =
            'GPS aktif, tetapi informasi alamat gagal dimuat.';
        }
      }
    },

    function(error) {
      sedangMemintaLokasi = false;

      var pesan =
        'Lokasi gagal diperoleh. Aktifkan layanan lokasi lalu coba lagi.';

      if (error.code === 1) {
        pesan =
          'Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini melalui pengaturan browser, kemudian tekan Coba Lagi.';
      } else if (error.code === 2) {
        pesan =
          'Posisi tidak tersedia. Aktifkan GPS atau layanan lokasi perangkat, lalu coba lagi.';
      } else if (error.code === 3) {
        pesan =
          'Pengambilan lokasi melewati batas waktu. Pastikan GPS aktif, lalu coba lagi.';
      }

      tampilkanLocationGate(pesan);

      var retryButton = document.getElementById('btnRetryLocation');

      if (retryButton) {
        retryButton.disabled = false;
        retryButton.innerHTML =
          '<i class="fa-solid fa-location-crosshairs mr-2"></i>Coba Lagi';
      }
    },

    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }
  );
}


// ==================== LOGIN PAGE ====================
function showLoginPage() {
  var pageLogin = document.getElementById('pageLogin');
  var pagePegawai = document.getElementById('pagePegawai');

  if (pageLogin) pageLogin.classList.remove('hidden');
  if (pagePegawai) pagePegawai.classList.add('hidden');
}


// ==================== REVERSE GEOCODING ====================
async function konversiKoordinatKeAlamat(lat, lng) {
  var url =
    'https://nominatim.openstreetmap.org/reverse' +
    '?format=jsonv2' +
    '&lat=' + encodeURIComponent(lat) +
    '&lon=' + encodeURIComponent(lng) +
    '&zoom=18' +
    '&addressdetails=1' +
    '&accept-language=id';

  var response = await fetch(url);

  if (!response.ok) {
    throw new Error('Gagal mengambil informasi alamat.');
  }

  var data = await response.json();
  var a = data.address || {};

  var jalan = a.road || a.pedestrian || a.residential || '';

  var wilayah = [
    a.hamlet || a.village || a.suburb || a.neighbourhood,
    a.city_district || a.district || a.county,
    a.city || a.town || a.municipality || a.regency,
    a.state
  ].filter(Boolean);

  var bagianAlamat = [
    jalan,
    ...wilayah
  ].filter(function(item, index, arr) {
    return arr.indexOf(item) === index;
  });

  return bagianAlamat.length
    ? bagianAlamat.join(', ')
    : (data.display_name || 'Alamat tidak ditemukan');
}


// ==================== PROSES LOGIN FRONTEND ====================
async function prosesLoginFrontend() {
  var nipInput = document.getElementById('loginNip').value.trim();
  var passInput = document.getElementById('loginPassword').value.trim();

  if (!nipInput || !passInput) {
    alert('NIP dan Password wajib diisi!');
    return;
  }

  var deviceImei = localStorage.getItem('device_unique_id');

  if (!deviceImei) {
    deviceImei =
      'WEB-' +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    localStorage.setItem('device_unique_id', deviceImei);
  }

  var btn =
    document.querySelector(
      '#loginForm button[onclick="prosesLoginFrontend()"]'
    ) ||
    document.querySelector(
      '#pageLogin button[onclick="prosesLoginFrontend()"]'
    );

  var originalText = btn ? btn.innerHTML : 'Masuk Aplikasi';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
  }

  try {
    var res = await callGAS('processLogin', {
      nip: nipInput,
      password: passInput,
      deviceImei: deviceImei
    });

    console.log('Respons API login:', res);

    if (!res || !res.success) {
      alert(
        res && res.message
          ? res.message
          : 'Login gagal. Periksa kembali NIP dan Password.'
      );
      return;
    }

    var userData = res.user || res.data;

    if (
      !userData ||
      typeof userData !== 'object' ||
      Array.isArray(userData)
    ) {
      console.error('Data pengguna tidak valid:', res);

      alert(
        'Login berhasil diproses, tetapi data pengguna tidak ditemukan. ' +
        'Periksa struktur respons fungsi processLogin di Code.gs.'
      );
      return;
    }

    var token = res.token || userData.token;

    if (!token || typeof token !== 'string') {
      console.error(
        'Token sesi tidak ditemukan pada respons login:',
        res
      );

      alert(
        'Login belum dapat digunakan karena server belum mengirim token sesi. ' +
        'Periksa fungsi processLogin di Code.gs.'
      );
      return;
    }

    if (typeof saveCurrentSessionUser !== 'function') {
      alert('Fungsi penyimpanan sesi dari api.js tidak ditemukan.');
      return;
    }

    currentUser = saveCurrentSessionUser(userData, token);

    var role = String(currentUser.role || '')
      .trim()
      .toUpperCase();

    if (role === 'ATASAN') {
      window.location.href = 'atasan/atasan.html';
      return;
    }

    if (role === 'ADMIN') {
      window.location.href = 'admin/admin.html';
      return;
    }

    if (role !== 'PEGAWAI') {
      if (typeof clearLocalSession === 'function') {
        clearLocalSession();
      }

      currentUser = null;
      alert('Peran pengguna tidak dikenali.');
      return;
    }

    window.location.href = 'index.html';
  } catch (error) {
    console.error('Kesalahan login:', error);
    alert('Terjadi kesalahan saat login. Silakan coba kembali.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// ==================== SHIFT & PERIODE ====================
function getFrontendShiftHours(shiftName) {
  var upper = (shiftName || '').toString().toUpperCase();

  if (upper.indexOf('PAGI') !== -1 || upper === 'S01') {
    return { jamMasuk: '06:00:00', jamPulang: '14:00:00' };
  } else if (upper.indexOf('SIANG') !== -1 || upper === 'S02') {
    return { jamMasuk: '14:00:00', jamPulang: '21:00:00' };
  } else if (upper.indexOf('MALAM') !== -1 || upper === 'S03') {
    return { jamMasuk: '21:00:00', jamPulang: '06:00:00' };
  }

  return { jamMasuk: '07:30:00', jamPulang: '16:00:00' };
}

function initPeriodeLabel() {
  var now = new Date();
  var dateNowStr =
    String(now.getDate()).padStart(2, '0') + ' ' +
    namaBulanIndo[now.getMonth()] + ' ' +
    now.getFullYear();

  var periode = document.getElementById('periodeRekap');
  var filterBulan = document.getElementById('filterBulan');
  var filterTahun = document.getElementById('filterTahun');

  if (periode) {
    periode.innerText =
      '01 ' + namaBulanIndo[now.getMonth()] + ' - ' + dateNowStr;
  }

  if (filterBulan) filterBulan.value = now.getMonth();
  if (filterTahun) filterTahun.value = now.getFullYear();
}

function checkAndApplyWeekendButtonState() {
  if (!currentUser) return;

  var now = new Date();
  var dayOfWeekToday = now.getDay();
  var shiftText = String(currentUser.shift || '').toUpperCase();
  var isReguler =
    shiftText.indexOf('REGULER') !== -1 || shiftText === 'SREG';

  var btnPresensi = document.getElementById('nav-presensi');
  if (!btnPresensi) return;

  if (isReguler && (dayOfWeekToday === 0 || dayOfWeekToday === 6)) {
    btnPresensi.disabled = true;
    btnPresensi.className =
      'absolute -top-5 bg-slate-400 text-slate-200 w-14 h-14 rounded-full shadow-md border-4 border-slate-50 flex items-center justify-center text-2xl cursor-not-allowed z-50';
    btnPresensi.title =
      'Hari ini libur akhir pekan untuk pegawai Reguler';
  } else {
    btnPresensi.disabled = false;
    btnPresensi.className =
      'absolute -top-5 bg-blue-700 hover:bg-blue-800 text-white w-14 h-14 rounded-full shadow-lg border-4 border-slate-50 flex items-center justify-center text-2xl transition active:scale-90 z-50';
    btnPresensi.title = 'Presensi';
  }
}


// ==================== INISIALISASI APLIKASI ====================
async function initAppWithUser(user) {
  tampilkanLocationGate(
    'Sedang memeriksa lokasi perangkat Anda. Izinkan akses lokasi untuk menggunakan aplikasi.'
  );

  mintaLokasiPegawai();

  var pageLogin = document.getElementById('pageLogin');
  var pagePegawai = document.getElementById('pagePegawai');

  if (pageLogin) pageLogin.classList.add('hidden');
  if (pagePegawai) pagePegawai.classList.remove('hidden');

  var headerNama = document.getElementById('headerNama');
  var headerJabatan = document.getElementById('headerJabatan');
  var headerInfo = document.getElementById('headerInfo');

  if (headerNama) headerNama.innerText = user.nama || '-';
  if (headerJabatan) headerJabatan.innerText = user.jabatan || '-';

  if (headerInfo) {
    headerInfo.innerText =
      'NIP: ' + (user.nip || '-') +
      ' | Shift: ' + (user.shift || '-');
  }

  var tanggalEl = document.getElementById('berandaTanggal');

  if (tanggalEl) {
    tanggalEl.textContent = new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date());
  }

  var accNama = document.getElementById('accNama');
  var accJabatan = document.getElementById('accJabatan');
  var accNip = document.getElementById('accNip');
  var accAtasan = document.getElementById('accAtasan');
  var accNoHp = document.getElementById('accNoHp');
  var accTtl = document.getElementById('accTtl');

  if (accNama) accNama.innerText = user.nama || '-';
  if (accJabatan) accJabatan.innerText = user.jabatan || '-';
  if (accNip) accNip.innerText = user.nip || '-';
  if (accAtasan) accAtasan.innerText = user.atasan || '-';

  var displayHp = user.noHp || '-';

  if (
    displayHp !== '-' &&
    !displayHp.startsWith('0') &&
    !displayHp.startsWith('+')
  ) {
    displayHp = '0' + displayHp;
  }

  if (accNoHp) accNoHp.innerText = displayHp;
  if (accTtl) accTtl.innerText = user.ttl || '-';

  var defaultShift = getFrontendShiftHours(user.shift);
  var jadwalMasuk = document.getElementById('jadwalMasuk');
  var jadwalPulang = document.getElementById('jadwalPulang');

  if (jadwalMasuk) jadwalMasuk.innerText = defaultShift.jamMasuk;
  if (jadwalPulang) jadwalPulang.innerText = defaultShift.jamPulang;

  initPeriodeLabel();
  checkAndApplyWeekendButtonState();

  var dataConfig = await callGAS('getAppData', {
    shift: user.shift
  });

  if (dataConfig && dataConfig.config) {
    appConfig = dataConfig;

    if (dataConfig.shiftInfo) {
      if (jadwalMasuk) {
        jadwalMasuk.innerText = dataConfig.shiftInfo.jamMasuk;
      }

      if (jadwalPulang) {
        jadwalPulang.innerText = dataConfig.shiftInfo.jamPulang;
      }
    }
  }

  await loadData();
}


// ==================== BATAS WAKTU PRESENSI ====================
function cekBatasWaktuPresensi() {
  if (!currentUser) return;

  var shiftCode = (currentUser.shift || 'SREG')
    .toString()
    .toUpperCase();

  var jamMasukStr = '07:30:00';

  if (
    shiftCode.indexOf('S02') !== -1 ||
    shiftCode.indexOf('SIANG') !== -1
  ) {
    jamMasukStr = '14:00:00';
  } else if (
    shiftCode.indexOf('S03') !== -1 ||
    shiftCode.indexOf('MALAM') !== -1
  ) {
    jamMasukStr = '21:00:00';
  } else if (
    shiftCode.indexOf('S01') !== -1 ||
    shiftCode.indexOf('PAGI') !== -1
  ) {
    jamMasukStr = '06:00:00';
  }

  var parts = jamMasukStr.split(':');
  var totalMenitBuka =
    parseInt(parts[0], 10) * 60 +
    parseInt(parts[1], 10) - 30;

  var now = new Date();
  var totalMenitSekarang =
    now.getHours() * 60 + now.getMinutes();

  var btnPresensi = document.getElementById('btnPresensiMasuk');
  if (!btnPresensi) return;

  var bukaHour = Math.floor(totalMenitBuka / 60);
  var bukaMinute = totalMenitBuka % 60;

  var jamBukaFormatted =
    String(bukaHour).padStart(2, '0') + ':' +
    String(bukaMinute).padStart(2, '0');

  if (totalMenitSekarang < totalMenitBuka) {
    btnPresensi.disabled = true;
    btnPresensi.className =
      'w-full bg-slate-200 text-slate-400 font-semibold py-3.5 rounded-2xl cursor-not-allowed shadow-none flex items-center justify-center gap-2';

    btnPresensi.innerHTML =
      '<i class="fa-solid fa-clock"></i> Presensi Buka Pukul ' +
      jamBukaFormatted + ' WIB';
  } else {
    btnPresensi.disabled = false;
    btnPresensi.className =
      'w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3.5 rounded-2xl shadow-lg shadow-blue-700/30 transition flex items-center justify-center gap-2';

    btnPresensi.innerHTML =
      '<i class="fa-solid fa-camera"></i> Lakukan Presensi Masuk';
  }
}

window.addEventListener('load', function() {
  cekBatasWaktuPresensi();
  setInterval(cekBatasWaktuPresensi, 60000);
});

function handleFingerClick() {
  if (!currentUser) {
    alert('Silakan login terlebih dahulu.');
    return;
  }

  var now = new Date();
  var dayOfWeekToday = now.getDay();
  var shiftText = String(currentUser.shift || '').toUpperCase();

  var isReguler =
    shiftText.indexOf('REGULER') !== -1 || shiftText === 'SREG';

  if (isReguler && (dayOfWeekToday === 0 || dayOfWeekToday === 6)) {
    alert('Hari ini libur akhir pekan untuk pegawai Reguler!');
    return;
  }

  if (activeTab !== 'presensi') {
    switchTab('presensi');
  } else {
    openModalKamera();
  }
}


// ==================== LOGBOOK ====================
function toggleLogbookFilter() {
  var panel = document.getElementById('logbookFilterPanel');

  if (panel) {
    panel.classList.toggle('hidden');
  }
}

function openModalUpload(bulanNama, tahun) {
  selectedUploadMonth = {
    bulanNama: bulanNama,
    tahun: tahun
  };

  var title = document.getElementById('uploadModalTitle');
  var fileInput = document.getElementById('fileLogbook');
  var modal = document.getElementById('modalUploadLogbook');

  if (title) {
    title.innerText =
      'Upload Logbook ' + bulanNama + ' ' + tahun;
  }

  if (fileInput) fileInput.value = '';
  if (modal) modal.classList.remove('hidden');
}

function closeModalUpload() {
  var modal = document.getElementById('modalUploadLogbook');

  if (modal) modal.classList.add('hidden');
}

async function submitLogbookFile() {
  var fileInput = document.getElementById('fileLogbook');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert('Silakan pilih file PDF terlebih dahulu!');
    return;
  }

  if (!selectedUploadMonth) {
    alert('Bulan logbook belum dipilih.');
    return;
  }

  var file = fileInput.files[0];

  if (
    file.type !== 'application/pdf' &&
    !file.name.toLowerCase().endsWith('.pdf')
  ) {
    alert('File harus berformat PDF!');
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    alert('Ukuran file terlalu besar! Maksimal 2 MB.');
    return;
  }

  var btn = document.getElementById('btnSubmitLogbook');

  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Mengunggah...';
  }

  try {
    var fileData = await convertFileToBase64(file);

    var payload = {
      nip: currentUser.nip,
      nama: currentUser.nama,
      bulanNama: selectedUploadMonth.bulanNama,
      tahun: selectedUploadMonth.tahun,
      fileData: fileData
    };

    var res = await callGAS('uploadLogbook', {
      payload: payload
    });

    if (res && res.success) {
      alert(res.message || 'Logbook berhasil diunggah.');
      closeModalUpload();
      await loadData();
    } else {
      alert(
        res && res.message
          ? res.message
          : 'Gagal mengunggah logbook.'
      );
    }
  } catch (error) {
    console.error('Kesalahan upload logbook:', error);
    alert('Terjadi kesalahan saat mengunggah logbook.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fa-solid fa-cloud-arrow-up"></i> Unggah File Logbook';
    }
  }
}

function convertFileToBase64(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();

    reader.onload = function() {
      resolve(reader.result);
    };

    reader.onerror = function(error) {
      reject(error);
    };

    reader.readAsDataURL(file);
  });
}

// ==================== FILTER BULAN & TAHUN ====================
function openModalFilterBulanTahun() {
  var modal = document.getElementById('modalFilterBulanTahun');
  if (modal) modal.classList.remove('hidden');
}

function closeModalFilterBulanTahun() {
  var modal = document.getElementById('modalFilterBulanTahun');
  if (modal) modal.classList.add('hidden');
}


// ==================== REKAP PRESENSI ====================
function ubahPeriodeRekap(periode) {
  var mapping = {
    'minggu-lalu': '1minggu_lalu',
    'minggu-ini': '1minggu_ini',
    'bulan-ini': '1bulan'
  };

  currentFilterType = mapping[periode] || '1bulan';

  document.querySelectorAll('.rekap-filter').forEach(function(btn) {
    var aktif = btn.dataset.rekapPeriode === periode;

    btn.className = aktif
      ? 'rekap-filter px-2 py-3 rounded-xl border border-[#1D4ED8] bg-blue-50 text-[#1D4ED8] text-[10px] font-bold'
      : 'rekap-filter px-2 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 text-[10px] font-semibold';
  });

  renderFilteredRekap();
}

function formatTanggalRekap(tanggal) {
  var parts = String(tanggal).slice(0, 10).split('-');

  if (parts.length !== 3) return tanggal;

  var date = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );

  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function getTanggalRekap(row) {
  var parts = String(row.tanggal || '').slice(0, 10).split('-');

  if (parts.length !== 3) return null;

  var date = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );

  return isNaN(date.getTime()) ? null : date;
}

function renderFilteredRekap() {
  var daftar = document.getElementById('rekapDaftarPresensi');
  if (!daftar) return;

  var now = new Date();
  var today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  var startDate;
  var endDate = new Date(today);

  if (currentFilterType === '1minggu_ini') {
    startDate = new Date(today);

    var day = startDate.getDay();

    startDate.setDate(
      startDate.getDate() - (day === 0 ? 6 : day - 1)
    );
  } else if (currentFilterType === '1minggu_lalu') {
    startDate = new Date(today);

    var dayLalu = startDate.getDay();

    startDate.setDate(
      startDate.getDate() -
      (dayLalu === 0 ? 6 : dayLalu - 1) - 7
    );

    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
  } else {
    startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );
  }

  endDate.setHours(23, 59, 59, 999);

  var logs = (rawLogsData || []).filter(function(row) {
    var date = getTanggalRekap(row);
    return date && date >= startDate && date <= endDate;
  });

  logs.sort(function(a, b) {
    return String(b.tanggal).localeCompare(String(a.tanggal));
  });

  var hadir = 0;
  var terlambat = 0;
  var izin = 0;

  logs.forEach(function(row) {
    var status = String(row.statusKode || '').toUpperCase();
    var ket = String(row.ketPresensi || '').toUpperCase();

    if (
      status === 'H' ||
      status === 'H(T)' ||
      status === 'H(PC)' ||
      status === 'H(TAP)'
    ) {
      hadir++;
    }

    if (status === 'H(T)') terlambat++;

    if (
      status.indexOf('IZIN') !== -1 ||
      status.indexOf('SAKIT') !== -1 ||
      ket.indexOf('IZIN') !== -1 ||
      ket.indexOf('SAKIT') !== -1
    ) {
      izin++;
    }
  });

  var elHadir = document.getElementById('rekapStatHadir');
  var elTerlambat = document.getElementById('rekapStatTerlambat');
  var elIzin = document.getElementById('rekapStatIzin');

  if (elHadir) elHadir.textContent = hadir + ' hari';
  if (elTerlambat) elTerlambat.textContent = terlambat + ' hari';
  if (elIzin) elIzin.textContent = izin + ' hari';

  var label = document.getElementById('rekapLabelPeriode');
  var rentang = document.getElementById('rekapRentangTanggal');
  var tahun = document.getElementById('rekapTahun');
  var subjudul = document.getElementById('rekapSubjudul');

  var bulan = namaBulanIndo[now.getMonth()];
  var tahunIni = now.getFullYear();

  if (currentFilterType === '1minggu_lalu') {
    if (label) label.textContent = '1 Minggu Lalu';

    if (rentang) {
      rentang.textContent =
        String(startDate.getDate()).padStart(2, '0') + ' - ' +
        String(endDate.getDate()).padStart(2, '0') + ' ' +
        namaBulanIndo[endDate.getMonth()] + ' ' +
        endDate.getFullYear();
    }
  } else if (currentFilterType === '1minggu_ini') {
    if (label) label.textContent = '1 Minggu';

    if (rentang) {
      rentang.textContent =
        String(startDate.getDate()).padStart(2, '0') + ' - ' +
        String(today.getDate()).padStart(2, '0') + ' ' +
        bulan + ' ' + tahunIni;
    }
  } else {
    if (label) label.textContent = '1 Bulan';

    if (rentang) {
      var lastDay = new Date(
        tahunIni,
        now.getMonth() + 1,
        0
      ).getDate();

      rentang.textContent =
        '01 - ' + String(lastDay).padStart(2, '0') + ' ' +
        bulan + ' ' + tahunIni;
    }
  }

  if (tahun) tahun.textContent = 'Tahun ' + tahunIni;

  if (subjudul) {
    subjudul.textContent =
      currentFilterType === '1bulan'
        ? bulan + ' ' + tahunIni
        : (label ? label.textContent : '');
  }

  if (logs.length === 0) {
    daftar.innerHTML =
      '<div class="bg-white border border-slate-200 rounded-2xl p-6 text-center">' +
        '<i class="fa-regular fa-calendar-xmark text-2xl text-slate-300"></i>' +
        '<p class="text-xs font-semibold text-slate-600 mt-2">' +
          'Belum ada catatan presensi pada periode ini.' +
        '</p>' +
      '</div>';

    return;
  }

  daftar.innerHTML = logs.map(function(row) {
    var status = String(row.statusKode || '-');
    var statusText = String(row.statusText || status);

    var badge =
      'bg-emerald-50 text-emerald-700 border-emerald-100';

    if (status === 'H(T)') {
      badge = 'bg-amber-50 text-amber-700 border-amber-100';
    } else if (status === 'H(PC)') {
      badge = 'bg-purple-50 text-purple-700 border-purple-100';
    } else if (status === 'LIBUR') {
      badge = 'bg-slate-100 text-slate-600 border-slate-200';
    } else if (status === '-' || status === 'TAP') {
      badge = 'bg-red-50 text-red-700 border-red-100';
    }

    return `
      <article class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h4 class="text-xs font-bold text-slate-800">
              ${formatTanggalRekap(row.tanggal)}
            </h4>
            <p class="text-[10px] text-slate-500 mt-1">
              ${statusText}
            </p>
          </div>
          <span title="${statusText}"
            class="shrink-0 border ${badge} px-2.5 py-1 rounded-full text-[10px] font-bold">
            ${status}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
          <div>
            <p class="text-[10px] text-slate-500">
              <i class="fa-solid fa-right-to-bracket text-green-600 mr-1"></i>
              Jam Masuk
            </p>
            <p class="text-sm font-bold text-green-700 mt-1">
              ${row.jamMasuk || '--:--:--'}
            </p>
          </div>
          <div>
            <p class="text-[10px] text-slate-500">
              <i class="fa-solid fa-right-from-bracket text-red-600 mr-1"></i>
              Jam Pulang
            </p>
            <p class="text-sm font-bold text-red-700 mt-1">
              ${row.jamPulang || '--:--:--'}
            </p>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function applyCustomMonthYearFilter() {
  currentFilterType = 'custom';

  var btnBulan = document.getElementById('btnFilterBulan');
  var btnMingguIni = document.getElementById('btnFilterMingguIni');
  var btnMingguLalu = document.getElementById('btnFilterMingguLalu');
  var btnIcon = document.getElementById('btnFilterIcon');

  if (btnBulan) {
    btnBulan.className =
      'flex-1 py-2 rounded-xl text-slate-600 transition';
  }

  if (btnMingguIni) {
    btnMingguIni.className =
      'flex-1 py-2 rounded-xl text-slate-600 transition';
  }

  if (btnMingguLalu) {
    btnMingguLalu.className =
      'flex-1 py-2 rounded-xl text-slate-600 transition';
  }

  if (btnIcon) {
    btnIcon.className =
      'w-9 h-9 rounded-xl bg-blue-700 text-white font-bold shadow-sm flex items-center justify-center transition shrink-0';
  }

  closeModalFilterBulanTahun();
  renderFilteredRekap();
}


// ==================== MEMUAT DATA APLIKASI ====================
async function loadData() {
  if (!currentUser) return;

  var res = await callGAS('getRekapData', {
    user: currentUser
  });

  if (!res || !res.success) {
    console.error(
      'Gagal memuat rekap:',
      res && res.message
    );
    return;
  }

  rawLogsData = res.logs || [];
  renderFilteredRekap();

  var uploadedLogbookList = res.logbook || [];

  var countHadir = 0;
  var countTerlambat = 0;
  var countIzin = 0;

  var now = new Date();

  var todayStr =
    now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  var dayOfWeekToday = now.getDay();
  var shiftText = String(currentUser.shift || '').toUpperCase();

  var isReguler =
    shiftText.indexOf('REGULER') !== -1 || shiftText === 'SREG';

  todayPresensiStatus.hasMasuk = false;
  todayPresensiStatus.hasPulang = false;

  var todayJamMasuk = document.getElementById('todayJamMasuk');
  var todayJamPulang = document.getElementById('todayJamPulang');

  if (
    isReguler &&
    (dayOfWeekToday === 0 || dayOfWeekToday === 6)
  ) {
    if (todayJamMasuk) {
      todayJamMasuk.innerText = 'Libur';
      todayJamMasuk.className =
        'text-lg font-extrabold text-red-600';
    }

    if (todayJamPulang) {
      todayJamPulang.innerText = 'Libur';
      todayJamPulang.className =
        'text-lg font-extrabold text-red-600';
    }
  } else {
    if (todayJamMasuk) {
      todayJamMasuk.innerText = '--:--:--';
      todayJamMasuk.className =
        'text-lg font-extrabold text-emerald-900';
    }

    if (todayJamPulang) {
      todayJamPulang.innerText = '--:--:--';
      todayJamPulang.className =
        'text-lg font-extrabold text-amber-900';
    }
  }

  rawLogsData.forEach(function(row) {
    var rowDate = new Date(row.tanggal);

    if (
      rowDate.getMonth() === now.getMonth() &&
      rowDate.getFullYear() === now.getFullYear()
    ) {
      if (row.hadir === 'H') countHadir++;
      if (row.terlambat === '(T)') countTerlambat++;
      if (row.izin && row.izin !== '-') countIzin++;
    }

    if (row.tanggal && row.tanggal.startsWith(todayStr)) {
      if (row.tipe === 'MASUK') {
        todayPresensiStatus.hasMasuk = true;

        if (todayJamMasuk) {
          todayJamMasuk.innerText = row.jamMasuk || '--:--:--';
        }
      }

      if (row.tipe === 'PULANG') {
        todayPresensiStatus.hasPulang = true;

        if (todayJamPulang) {
          todayJamPulang.innerText = row.jamPulang || '--:--:--';
        }
      }
    }
  });

  var statHadir = document.getElementById('statHadir');
  var statTerlambat = document.getElementById('statTerlambat');
  var statIzin = document.getElementById('statIzin');

  if (statHadir) statHadir.innerText = countHadir + ' hari';
  if (statTerlambat) statTerlambat.innerText = countTerlambat + ' hari';
  if (statIzin) statIzin.innerText = countIzin + ' hari';

  renderFilteredRekap();

  var filterTahunLogbook = document.getElementById('filterTahunLogbook');

  var selectedTahun = filterTahunLogbook
    ? filterTahunLogbook.value
    : now.getFullYear().toString();

  var currentMonthIdx = now.getMonth();
  var currentYearNum = now.getFullYear();
  var htmlLogbook = '';

  namaBulanIndo.forEach(function(bulanName, m) {
    var isCurrentMonth =
      m === currentMonthIdx &&
      parseInt(selectedTahun, 10) === currentYearNum;

    var isPastMonth =
      parseInt(selectedTahun, 10) < currentYearNum ||
      (
        parseInt(selectedTahun, 10) === currentYearNum &&
        m < currentMonthIdx
      );

    var existingFile = uploadedLogbookList.find(function(item) {
      return (
        item.bulan &&
        item.bulan.toLowerCase() === bulanName.toLowerCase() &&
        item.tahun.toString() === selectedTahun.toString()
      );
    });

    var hasFile =
      existingFile &&
      existingFile.fileUrl &&
      existingFile.fileUrl !== '#';

    htmlLogbook +=
      '<div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">' +
        '<div>' +
          '<p class="font-bold text-slate-800 text-xs">Logbook ' +
            bulanName + ' ' + selectedTahun + '</p>' +
          '<p class="text-[10px] text-slate-400">' +
            (
              isCurrentMonth
                ? 'Bulan Berjalan (Aktif)'
                : (
                    hasFile
                      ? 'Sudah Diunggah'
                      : (
                          isPastMonth
                            ? 'Bulan Terlewat'
                            : 'Mendatang'
                        )
                  )
            ) +
          '</p>' +
        '</div>' +
        '<div class="flex items-center gap-1.5">';

    if (hasFile) {
      htmlLogbook +=
        '<a href="' + existingFile.fileUrl +
        '" target="_blank" rel="noopener noreferrer" ' +
        'class="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl font-bold text-xs border border-blue-200 flex items-center gap-1">' +
          '<i class="fa-solid fa-file-pdf"></i> Lihat' +
        '</a>';

      if (isCurrentMonth) {
        htmlLogbook +=
          '<button type="button" onclick="openModalUpload(\'' +
          bulanName + '\', ' + selectedTahun + ')" ' +
          'class="bg-amber-50 text-amber-700 px-2.5 py-1.5 rounded-xl font-bold text-xs border border-amber-200" title="Ganti File">' +
            '<i class="fa-solid fa-pen-to-square"></i>' +
          '</button>';
      }
    } else if (isCurrentMonth) {
      htmlLogbook +=
        '<button type="button" onclick="openModalUpload(\'' +
        bulanName + '\', ' + selectedTahun + ')" ' +
        'class="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1">' +
          '<i class="fa-solid fa-cloud-arrow-up"></i> Upload' +
        '</button>';
    } else if (isPastMonth) {
      htmlLogbook +=
        '<span class="text-[10px] font-semibold text-rose-500 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">' +
          'Tidak Diunggah' +
        '</span>';
    } else {
      htmlLogbook +=
        '<span class="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">' +
          'Belum Waktunya' +
        '</span>';
    }

    htmlLogbook += '</div></div>';
  });

  var logbookList = document.getElementById('logbookList');

  if (logbookList) {
    logbookList.innerHTML = htmlLogbook;
  }
}


// ==================== NAVIGASI TAB ====================
function switchTab(tab) {
  activeTab = tab;

  var allTabs = [
    'beranda',
    'rekap',
    'presensi',
    'logbook',
    'akun',
    'form-izin'
  ];

  allTabs.forEach(function(t) {
    var el = document.getElementById('tab-' + t);

    if (el) el.classList.add('hidden');
  });

  var targetTab = document.getElementById('tab-' + tab);

  if (targetTab) {
    targetTab.classList.remove('hidden');
  }

  var navTabs = ['beranda', 'rekap', 'logbook', 'akun'];

  navTabs.forEach(function(t) {
    var navButton = document.getElementById('nav-' + t);

    if (!navButton) return;

    if (t === tab) {
      navButton.classList.remove('text-slate-400');
      navButton.classList.add('text-blue-700');
    } else {
      navButton.classList.remove('text-blue-700');
      navButton.classList.add('text-slate-400');
    }
  });

  if (tab === 'presensi') {
    setTimeout(function() {
      if (typeof initMap === 'function') {
        initMap();
      }

      if (typeof map !== 'undefined' && map !== null) {
        map.invalidateSize();

        if (currentLat && currentLng) {
          map.setView([currentLat, currentLng], 17);
        }
      }
    }, 250);
  }

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


// ==================== FORM PENGAJUAN IZIN ====================
function openPageIzin() {
  var ids = [
    'izinJenisPage',
    'izinTglMulaiPage',
    'izinTglSelesaiPage',
    'izinAlasanPage',
    'izinLampiranPage'
  ];

  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });

  handleJenisIzinPageChange();
  switchTab('form-izin');
}

function handleJenisIzinPageChange() {
  var jenisEl = document.getElementById('izinJenisPage');
  var labelWajib = document.getElementById('labelWajibLampiranPage');

  if (!jenisEl || !labelWajib) return;

  if (jenisEl.value === 'Sakit') {
    labelWajib.classList.remove('hidden');
  } else {
    labelWajib.classList.add('hidden');
  }
}

async function submitPengajuanIzinPage() {
  var jenisEl = document.getElementById('izinJenisPage');
  var mulaiEl = document.getElementById('izinTglMulaiPage');
  var selesaiEl = document.getElementById('izinTglSelesaiPage');
  var alasanEl = document.getElementById('izinAlasanPage');
  var fileInput = document.getElementById('izinLampiranPage');

  if (!jenisEl || !mulaiEl || !selesaiEl || !alasanEl || !fileInput) {
    alert('Form pengajuan izin tidak ditemukan.');
    return;
  }

  var jenis = jenisEl.value;
  var tglMulai = mulaiEl.value;
  var tglSelesai = selesaiEl.value;
  var alasan = alasanEl.value;

  if (!jenis || !tglMulai || !tglSelesai || !alasan) {
    alert('Harap lengkapi semua kolom yang wajib diisi!');
    return;
  }

  if (tglSelesai < tglMulai) {
    alert('Tanggal selesai tidak boleh sebelum tanggal mulai.');
    return;
  }

  if (
    jenis === 'Sakit' &&
    (!fileInput.files || fileInput.files.length === 0)
  ) {
    alert(
      'Untuk izin Sakit, Anda wajib mengunggah Surat Dokter dalam format PDF!'
    );
    return;
  }

  var base64Data = null;

  if (fileInput.files && fileInput.files.length > 0) {
    var file = fileInput.files[0];

    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      alert(
        'Format file tidak valid! Lampiran hanya menerima file berformat PDF.'
      );
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file terlalu besar! Maksimal ukuran file adalah 2 MB.');
      return;
    }

    try {
      base64Data = await convertFileToBase64(file);
    } catch (error) {
      console.error('Gagal membaca lampiran:', error);
      alert('Lampiran gagal dibaca. Silakan pilih file kembali.');
      return;
    }
  }

  var btn = document.getElementById('btnSubmitIzinPage');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim Pengajuan...';
  }

  try {
    var payload = {
      nip: currentUser.nip,
      nama: currentUser.nama,
      jenisIzin: jenis,
      tglMulai: tglMulai,
      tglSelesai: tglSelesai,
      alasan: alasan,
      lampiranBase64: base64Data
    };

    var res = await callGAS('submitIzin', {
      payload: payload
    });

    if (res && res.success) {
      alert(res.message || 'Pengajuan izin berhasil dikirim.');
      switchTab('beranda');
      await loadData();
    } else {
      alert(
        res && res.message
          ? res.message
          : 'Gagal mengirim pengajuan izin.'
      );
    }
  } catch (error) {
    console.error('Kesalahan pengajuan izin:', error);
    alert('Terjadi kesalahan saat mengirim pengajuan izin.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fa-solid fa-paper-plane"></i> Kirim Pengajuan Izin';
    }
  }
}


// ==================== LOGOUT ====================
async function logout() {
  try {
    if (typeof logoutUser === 'function') {
      await logoutUser();
    } else if (typeof clearLocalSession === 'function') {
      clearLocalSession();
    }
  } catch (error) {
    console.error('Kesalahan saat logout:', error);

    if (typeof clearLocalSession === 'function') {
      clearLocalSession();
    }
  }

  currentUser = null;

  if (mediaStream) {
    mediaStream.getTracks().forEach(function(track) {
      track.stop();
    });

    mediaStream = null;
  }

  window.location.replace('index.html');
}