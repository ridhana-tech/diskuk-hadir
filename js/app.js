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

var namaBulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
var SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 jam

var lokasiPegawaiValid = false;
var sedangMemintaLokasi = false;


// ==================== INITIALIZATION ====================
window.onload = function() {
  var savedUser = localStorage.getItem('currentUser');
  var user = null;

  if (savedUser) {
    try {
      user = JSON.parse(savedUser);

      // Sesi tidak ada, tidak valid, atau sudah kedaluwarsa
      if (
        !user ||
        !user._sessionExpiresAt ||
        Date.now() >= Number(user._sessionExpiresAt)
      ) {
        user = null;
      }
    } catch (e) {
      user = null;
    }
  }

  if (!user) {
    localStorage.removeItem('currentUser');
    currentUser = null;
    showLoginPage();
    return;
  }

  currentUser = user;

  // Arahkan sesuai peran pengguna
  if (currentUser.role === 'ATASAN') {
    window.location.replace('atasan.html');
    return;
  }

  if (currentUser.role === 'ADMIN') {
    window.location.replace('admin.html');
    return;
  }

  if (currentUser.role !== 'PEGAWAI') {
    localStorage.removeItem('currentUser');
    currentUser = null;
    showLoginPage();
    return;
  }

  // Sesi valid: masuk ke aplikasi Pegawai
  document.getElementById('pageLogin').classList.add('hidden');
  document.getElementById('pagePegawai').classList.remove('hidden');

  initAppWithUser(currentUser);
};

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
  if (statusLokasi) statusLokasi.textContent = 'Sedang meminta koordinat GPS...';

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
      var btn = document.getElementById('btnRetryLocation');

      if (berandaLokasi) {
        berandaLokasi.textContent = 'Mencari alamat lokasi...';
      }

      if (status) {
        status.textContent = 'GPS aktif • Akurasi sekitar ' +
          akurasi + ' meter';
      }

      if (badge) {
        badge.textContent = 'GPS Aktif';
        badge.className =
          'text-[9px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700';
      }

      if (gate) gate.classList.add('hidden');

      if (btn) {
        btn.disabled = false;
        btn.innerHTML =
          '<i class="fa-solid fa-location-crosshairs mr-2"></i>Aktifkan / Coba Lagi';
      }

      // Pusatkan peta jika sudah tersedia.
      if (typeof map !== 'undefined' && map !== null) {
        map.invalidateSize();
        map.setView([currentLat, currentLng], 17);
      }

      // Konversi GPS menjadi nama jalan dan wilayah.
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

      var pesan = 'Lokasi gagal diperoleh. Aktifkan layanan lokasi lalu coba lagi.';

      if (error.code === 1) {
        pesan = 'Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini melalui pengaturan browser, kemudian tekan Coba Lagi.';
      } else if (error.code === 2) {
        pesan = 'Posisi tidak tersedia. Aktifkan GPS atau layanan lokasi perangkat, lalu coba lagi.';
      } else if (error.code === 3) {
        pesan = 'Pengambilan lokasi melewati batas waktu. Pastikan GPS aktif, lalu coba lagi.';
      }

      tampilkanLocationGate(pesan);

      if (btn) {
        btn.disabled = false;
        btn.innerHTML =
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


// Fungsi pembantu untuk menampilkan Halaman Login
function showLoginPage() {
  var pageLogin = document.getElementById('pageLogin');
  var pagePegawai = document.getElementById('pagePegawai');

  if (pageLogin) pageLogin.classList.remove('hidden');
  if (pagePegawai) pagePegawai.classList.add('hidden');
}

async function konversiKoordinatKeAlamat(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?format=jsonv2` +
    `&lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lng)}` +
    `&zoom=18` +
    `&addressdetails=1` +
    `&accept-language=id`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Gagal mengambil informasi alamat.');
  }

  const data = await response.json();
  const a = data.address || {};

  const jalan = a.road || a.pedestrian || a.residential || '';
  const wilayah = [
    a.hamlet || a.village || a.suburb || a.neighbourhood,
    a.city_district || a.district || a.county,
    a.city || a.town || a.municipality || a.regency,
    a.state
  ].filter(Boolean);

  const bagianAlamat = [
    jalan,
    ...wilayah
  ].filter((item, index, arr) => arr.indexOf(item) === index);

  return bagianAlamat.length
    ? bagianAlamat.join(', ')
    : (data.display_name || 'Alamat tidak ditemukan');
}

// ==================== PROSES LOGIN FRONTEND ====================

async function prosesLoginFrontend() {
  const nipInput = document.getElementById('loginNip').value.trim();
  const passInput = document.getElementById('loginPassword').value.trim();

  if (!nipInput || !passInput) {
    alert('NIP dan Password wajib diisi!');
    return;
  }

  // ID unik perangkat/browser
  let deviceImei = localStorage.getItem('device_unique_id');

  if (!deviceImei) {
    deviceImei =
      'WEB-' +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    localStorage.setItem('device_unique_id', deviceImei);
  }

  const btn =
  document.querySelector('#loginForm button[onclick="prosesLoginFrontend()"]')
  || document.querySelector('#pageLogin button[onclick="prosesLoginFrontend()"]');

  const originalText = btn ? btn.innerHTML : 'Masuk Aplikasi';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
  }

  try {
    const res = await callGAS('processLogin', {
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

    // Sesuaikan dengan struktur respons backend
    const userData = res.user || res.data;

    if (!userData || typeof userData !== 'object' || Array.isArray(userData)) {
      console.error('Data pengguna tidak valid:', res);
      alert(
        'Login berhasil diproses, tetapi data pengguna tidak ditemukan. ' +
        'Periksa struktur respons fungsi processLogin di Code.gs.'
      );
      return;
    }

    // Pastikan objek pengguna valid sebelum menambahkan masa berlaku sesi
    const expiresAt = Date.now() + SESSION_DURATION_MS;

    currentUser = {
      ...userData,
      _sessionExpiresAt: expiresAt
    };

    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    // Arahkan berdasarkan role
    if (currentUser.role === 'ATASAN') {
      window.location.href = 'atasan.html';
      return;
    }

    if (currentUser.role === 'ADMIN') {
      window.location.href = 'admin.html';
      return;
    }

    // Tampilkan halaman pegawai
    const pageLogin = document.getElementById('pageLogin');
    const pagePegawai = document.getElementById('pagePegawai');

    if (!pageLogin || !pagePegawai) {
      console.error('Elemen halaman login atau pegawai tidak ditemukan.');
      alert('Elemen halaman aplikasi tidak ditemukan. Periksa struktur index.html.');
      return;
    }

    pageLogin.classList.add('hidden');
    pagePegawai.classList.remove('hidden');

    initAppWithUser(currentUser);

  } catch (e) {
    console.error('Kesalahan login:', e);
    alert('Terjadi kesalahan koneksi ke server: ' + e.toString());

  } finally {
    if (btn && document.contains(btn)) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

function getFrontendShiftHours(shiftName) {
  var upper = (shiftName || '').toString().toUpperCase();
  if (upper.indexOf('PAGI') !== -1 || upper === 'S01') {
    return { jamMasuk: "06:00:00", jamPulang: "14:00:00" };
  } else if (upper.indexOf('SIANG') !== -1 || upper === 'S02') {
    return { jamMasuk: "14:00:00", jamPulang: "21:00:00" };
  } else if (upper.indexOf('MALAM') !== -1 || upper === 'S03') {
    return { jamMasuk: "21:00:00", jamPulang: "06:00:00" };
  } else {
    return { jamMasuk: "07:30:00", jamPulang: "16:00:00" }; // Reguler
  }
}

function initPeriodeLabel() {
  var now = new Date();
  var dateNowStr = String(now.getDate()).padStart(2, '0') + ' ' + namaBulanIndo[now.getMonth()] + ' ' + now.getFullYear();
  document.getElementById('periodeRekap').innerText = '01 ' + namaBulanIndo[now.getMonth()] + ' - ' + dateNowStr;
  
  document.getElementById('filterBulan').value = now.getMonth();
  document.getElementById('filterTahun').value = now.getFullYear();
}

function checkAndApplyWeekendButtonState() {
  if (!currentUser) return;

  var now = new Date();
  var dayOfWeekToday = now.getDay();
  var isReguler = (currentUser.shift.toString().toUpperCase().indexOf('REGULER') !== -1 || currentUser.shift.toString().toUpperCase() === 'SREG');
  var btnPresensi = document.getElementById('nav-presensi');

  if (isReguler && (dayOfWeekToday === 0 || dayOfWeekToday === 6)) {
    btnPresensi.disabled = true;
    btnPresensi.className = "absolute -top-5 bg-slate-400 text-slate-200 w-14 h-14 rounded-full shadow-md border-4 border-slate-50 flex items-center justify-center text-2xl cursor-not-allowed z-50";
    btnPresensi.title = "Hari ini libur akhir pekan untuk pegawai Reguler";
  } else {
    btnPresensi.disabled = false;
    btnPresensi.className = "absolute -top-5 bg-blue-700 hover:bg-blue-800 text-white w-14 h-14 rounded-full shadow-lg border-4 border-slate-50 flex items-center justify-center text-2xl transition active:scale-90 z-50";
    btnPresensi.title = "Presensi";
  }
}

async function initAppWithUser(user) {
  tampilkanLocationGate(
    'Sedang memeriksa lokasi perangkat Anda. Izinkan akses lokasi untuk menggunakan aplikasi.'
  );

  mintaLokasiPegawai();

  document.getElementById('pageLogin').classList.add('hidden');
  document.getElementById('pagePegawai').classList.remove('hidden');
  
  document.getElementById('headerNama').innerText = user.nama || '-';
  document.getElementById('headerJabatan').innerText = user.jabatan || '-';
  document.getElementById('headerInfo').innerText =
    'NIP: ' + (user.nip || '-') + ' | Shift: ' + (user.shift || '-');

  const tanggalEl = document.getElementById('berandaTanggal');
  if (tanggalEl) {
    tanggalEl.textContent = new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date());
  }
  
  document.getElementById('accNama').innerText = user.nama;
  document.getElementById('accJabatan').innerText = user.jabatan;
  document.getElementById('accNip').innerText = user.nip;
  document.getElementById('accAtasan').innerText = user.atasan || '-';

  var displayHp = user.noHp || '-';
  if (displayHp !== '-' && !displayHp.startsWith('0') && !displayHp.startsWith('+')) {
    displayHp = '0' + displayHp;
  }
  document.getElementById('accNoHp').innerText = displayHp;
  document.getElementById('accTtl').innerText = user.ttl || '-';

  var defaultShift = getFrontendShiftHours(user.shift);
  document.getElementById('jadwalMasuk').innerText = defaultShift.jamMasuk;
  document.getElementById('jadwalPulang').innerText = defaultShift.jamPulang;

  initPeriodeLabel();
  checkAndApplyWeekendButtonState();

  const dataConfig = await callGAS('getAppData', { shift: user.shift });
  if (dataConfig && dataConfig.config) {
    appConfig = dataConfig;
    if (dataConfig.shiftInfo) {
      document.getElementById('jadwalMasuk').innerText = dataConfig.shiftInfo.jamMasuk;
      document.getElementById('jadwalPulang').innerText = dataConfig.shiftInfo.jamPulang;
    }
  }

  loadData();
}

function cekBatasWaktuPresensi() {
  if (!currentUser) return;

  var shiftCode = (currentUser.shift || 'SREG').toString().toUpperCase();
  var jamMasukStr = "07:30:00";

  if (shiftCode.indexOf('S02') !== -1 || shiftCode.indexOf('SIANG') !== -1) {
    jamMasukStr = "14:00:00";
  } else if (shiftCode.indexOf('S03') !== -1 || shiftCode.indexOf('MALAM') !== -1) {
    jamMasukStr = "21:00:00";
  } else if (shiftCode.indexOf('S01') !== -1 || shiftCode.indexOf('PAGI') !== -1) {
    jamMasukStr = "06:00:00";
  } else {
    jamMasukStr = "07:30:00";
  }

  var parts = jamMasukStr.split(':');
  var totalMenitBuka = (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10) - 30;

  var now = new Date();
  var totalMenitSekarang = (now.getHours() * 60) + now.getMinutes();

  var btnPresensi = document.getElementById('btnPresensiMasuk');
  if (!btnPresensi) return;

  var bukaHour = Math.floor(totalMenitBuka / 60);
  var bukaMinute = totalMenitBuka % 60;
  var jamBukaFormatted = String(bukaHour).padStart(2, '0') + ':' + String(bukaMinute).padStart(2, '0');

  if (totalMenitSekarang < totalMenitBuka) {
    btnPresensi.disabled = true;
    btnPresensi.className = "w-full bg-slate-200 text-slate-400 font-semibold py-3.5 rounded-2xl cursor-not-allowed shadow-none flex items-center justify-center gap-2";
    btnPresensi.innerHTML = '<i class="fa-solid fa-clock"></i> Presensi Buka Pukul ' + jamBukaFormatted + ' WIB';
  } else {
    btnPresensi.disabled = false;
    btnPresensi.className = "w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3.5 rounded-2xl shadow-lg shadow-blue-700/30 transition flex items-center justify-center gap-2";
    btnPresensi.innerHTML = '<i class="fa-solid fa-camera"></i> Lakukan Presensi Masuk';
  }
}

window.addEventListener('load', function() {
  cekBatasWaktuPresensi();
  setInterval(cekBatasWaktuPresensi, 60000);
});

function handleFingerClick() {
  var now = new Date();
  var dayOfWeekToday = now.getDay();
  var isReguler = (currentUser.shift.toString().toUpperCase().indexOf('REGULER') !== -1 || currentUser.shift.toString().toUpperCase() === 'SREG');

  if (isReguler && (dayOfWeekToday === 0 || dayOfWeekToday === 6)) {
    return alert("Hari ini libur akhir pekan untuk pegawai Reguler!");
  }

  if (activeTab !== 'presensi') {
    switchTab('presensi');
  } else {
    openModalKamera();
  }
}

// ==================== PANEL FILTER LOGBOOK & RENDER ====================
function toggleLogbookFilter() {
  var panel = document.getElementById('logbookFilterPanel');
  if (panel) {
    panel.classList.toggle('hidden');
  }
}

function openModalUpload(bulanNama, tahun) {
  selectedUploadMonth = { bulanNama: bulanNama, tahun: tahun };
  document.getElementById('uploadModalTitle').innerText = 'Upload Logbook ' + bulanNama + ' ' + tahun;
  document.getElementById('fileLogbook').value = '';
  document.getElementById('modalUploadLogbook').classList.remove('hidden');
}

function closeModalUpload() {
  document.getElementById('modalUploadLogbook').classList.add('hidden');
}

function submitLogbookFile() {
  var fileInput = document.getElementById('fileLogbook');
  if (!fileInput.files || fileInput.files.length === 0) return alert('Silakan pilih file PDF terlebih dahulu!');

  var file = fileInput.files[0];
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return alert('File harus berformat PDF!');
  }
  if (file.size > 2 * 1024 * 1024) {
    return alert('Ukuran file terlalu besar! Maksimal 2 MB.');
  }

  var btn = document.getElementById('btnSubmitLogbook');
  btn.disabled = true;
  btn.innerText = 'Mengunggah...';

  var reader = new FileReader();
  reader.onload = async function(e) {
    var payload = {
      nip: currentUser.nip,
      nama: currentUser.nama,
      bulanNama: selectedUploadMonth.bulanNama,
      tahun: selectedUploadMonth.tahun,
      fileData: e.target.result
    };

    const res = await callGAS('uploadLogbook', { payload: payload });
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Unggah File Logbook';
    closeModalUpload();

    alert(res.message);
    if (res.success) loadData();
  };
  reader.readAsDataURL(file);
}

function openModalFilterBulanTahun() {
  document.getElementById('modalFilterBulanTahun').classList.remove('hidden');
}

function closeModalFilterBulanTahun() {
  document.getElementById('modalFilterBulanTahun').classList.add('hidden');
}


/* ==========================================
   REKAP PRESENSI PEGAWAI
   Terhubung ke data getRekapData dari API
========================================== */

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

  // Hindari pergeseran tanggal akibat parsing UTC.
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
    now.getFullYear(), now.getMonth(), now.getDate()
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
      startDate.getDate() - (dayLalu === 0 ? 6 : dayLalu - 1) - 7
    );
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  endDate.setHours(23, 59, 59, 999);

  var logs = (rawLogsData || []).filter(function(row) {
    var date = getTanggalRekap(row);
    return date && date >= startDate && date <= endDate;
  });

  // Urutkan tanggal terbaru ke terlama.
  logs.sort(function(a, b) {
    return String(b.tanggal).localeCompare(String(a.tanggal));
  });

  // Hitung ringkasan dari hasil API pada periode terpilih.
  var hadir = 0;
  var terlambat = 0;
  var izin = 0;

  logs.forEach(function(row) {
    var status = String(row.statusKode || '').toUpperCase();
    var ket = String(row.ketPresensi || '').toUpperCase();

    if (status === 'H' || status === 'H(T)' ||
        status === 'H(PC)' || status === 'H(TAP)') {
      hadir++;
    }

    if (status === 'H(T)') terlambat++;

    if (status.indexOf('IZIN') !== -1 ||
        status.indexOf('SAKIT') !== -1 ||
        ket.indexOf('IZIN') !== -1 ||
        ket.indexOf('SAKIT') !== -1) {
      izin++;
    }
  });

  var elHadir = document.getElementById('rekapStatHadir');
  var elTerlambat = document.getElementById('rekapStatTerlambat');
  var elIzin = document.getElementById('rekapStatIzin');

  if (elHadir) elHadir.textContent = hadir + ' hari';
  if (elTerlambat) elTerlambat.textContent = terlambat + ' hari';
  if (elIzin) elIzin.textContent = izin + ' hari';

  // Perbarui informasi periode.
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
      var lastDay = new Date(tahunIni, now.getMonth() + 1, 0).getDate();
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
        : label.textContent;
  }

  // Render daftar kartu.
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
    var badge = 'bg-emerald-50 text-emerald-700 border-emerald-100';

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

  btnBulan.className = "flex-1 py-2 rounded-xl text-slate-600 transition";
  btnMingguIni.className = "flex-1 py-2 rounded-xl text-slate-600 transition";
  btnMingguLalu.className = "flex-1 py-2 rounded-xl text-slate-600 transition";
  btnIcon.className = "w-9 h-9 rounded-xl bg-blue-700 text-white font-bold shadow-sm flex items-center justify-center transition shrink-0";

  closeModalFilterBulanTahun();
  renderFilteredRekap();
}

async function loadData() {
  if (!currentUser) return;

  const res = await callGAS('getRekapData', { user: currentUser });
  if (!res || !res.success) {
    console.error('Gagal memuat rekap:', res && res.message);
    return;
  }

  rawLogsData = res.logs || [];
  renderFilteredRekap();
  var uploadedLogbookList = res.logbook || [];

  var countHadir = 0, countTerlambat = 0, countIzin = 0;
  var now = new Date();
  var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  var dayOfWeekToday = now.getDay();
  var isReguler = (currentUser.shift.toString().toUpperCase().indexOf('REGULER') !== -1 || currentUser.shift.toString().toUpperCase() === 'SREG');

  todayPresensiStatus.hasMasuk = false;
  todayPresensiStatus.hasPulang = false;

  if (isReguler && (dayOfWeekToday === 0 || dayOfWeekToday === 6)) {
    document.getElementById('todayJamMasuk').innerText = 'Libur';
    document.getElementById('todayJamMasuk').className = 'text-lg font-extrabold text-red-600';
    document.getElementById('todayJamPulang').innerText = 'Libur';
    document.getElementById('todayJamPulang').className = 'text-lg font-extrabold text-red-600';
  } else {
    document.getElementById('todayJamMasuk').innerText = '--:--:--';
    document.getElementById('todayJamMasuk').className = 'text-lg font-extrabold text-emerald-900';
    document.getElementById('todayJamPulang').innerText = '--:--:--';
    document.getElementById('todayJamPulang').className = 'text-lg font-extrabold text-amber-900';
  }

  rawLogsData.forEach(function(row) {
    var rowDate = new Date(row.tanggal);
    if (rowDate.getMonth() === now.getMonth() && rowDate.getFullYear() === now.getFullYear()) {
      if (row.hadir === 'H') countHadir++;
      if (row.terlambat === '(T)') countTerlambat++;
      if (row.izin && row.izin !== '-') countIzin++;
    }

    if (row.tanggal && row.tanggal.startsWith(todayStr)) {
      if (row.tipe === 'MASUK') {
        todayPresensiStatus.hasMasuk = true;
        document.getElementById('todayJamMasuk').innerText = row.jamMasuk || '--:--:--';
      }
      if (row.tipe === 'PULANG') {
        todayPresensiStatus.hasPulang = true;
        document.getElementById('todayJamPulang').innerText = row.jamPulang || '--:--:--';
      }
    }
  });

  document.getElementById('statHadir').innerText = countHadir + ' hari';
  document.getElementById('statTerlambat').innerText = countTerlambat + ' hari';
  document.getElementById('statIzin').innerText = countIzin + ' hari';

  renderFilteredRekap();

  // RENDER LOGBOOK: 12 Bulan penuh dengan filter tahun
  var selectedTahun = document.getElementById('filterTahunLogbook') ? document.getElementById('filterTahunLogbook').value : now.getFullYear().toString();
  var currentMonthIdx = now.getMonth();
  var currentYearNum = now.getFullYear();
  var htmlLogbook = '';

  namaBulanIndo.forEach(function(bulanName, m) {
    var isCurrentMonth = (m === currentMonthIdx && parseInt(selectedTahun) === currentYearNum);
    var isPastMonth = (parseInt(selectedTahun) < currentYearNum) || (parseInt(selectedTahun) === currentYearNum && m < currentMonthIdx);

    var existingFile = uploadedLogbookList.find(function(item) {
      return item.bulan && item.bulan.toLowerCase() === bulanName.toLowerCase() && 
             item.tahun.toString() === selectedTahun.toString();
    });

    var hasFile = existingFile && existingFile.fileUrl && existingFile.fileUrl !== '#';

    htmlLogbook += '<div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">' +
      '<div>' +
        '<p class="font-bold text-slate-800 text-xs">Logbook ' + bulanName + ' ' + selectedTahun + '</p>' +
        '<p class="text-[10px] text-slate-400">' + 
          (isCurrentMonth ? 'Bulan Berjalan (Aktif)' : (hasFile ? 'Sudah Diunggah' : (isPastMonth ? 'Bulan Terlewat' : 'Mendatang'))) + 
        '</p>' +
      '</div>';

    htmlLogbook += '<div class="flex items-center gap-1.5">';
    
    if (hasFile) {
      htmlLogbook += '<a href="' + existingFile.fileUrl + '" target="_blank" class="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl font-bold text-xs border border-blue-200 flex items-center gap-1">' +
        '<i class="fa-solid fa-file-pdf"></i> Lihat' +
      '</a>';
      
      if (isCurrentMonth) {
        htmlLogbook += '<button type="button" onclick="openModalUpload(\'' + bulanName + '\', ' + selectedTahun + ')" class="bg-amber-50 text-amber-700 px-2.5 py-1.5 rounded-xl font-bold text-xs border border-amber-200" title="Ganti File">' +
          '<i class="fa-solid fa-pen-to-square"></i>' +
        '</button>';
      }
    } else {
      if (isCurrentMonth) {
        htmlLogbook += '<button type="button" onclick="openModalUpload(\'' + bulanName + '\', ' + selectedTahun + ')" class="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1">' +
          '<i class="fa-solid fa-cloud-arrow-up"></i> Upload' +
        '</button>';
      } else if (isPastMonth) {
        htmlLogbook += '<span class="text-[10px] font-semibold text-rose-500 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">Tidak Diunggah</span>';
      } else {
        htmlLogbook += '<span class="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">Belum Waktunya</span>';
      }
    }

    htmlLogbook += '</div></div>';
  });

  document.getElementById('logbookList').innerHTML = htmlLogbook;
}

// ==================== NAVIGASI TAB & FORM IZIN ====================

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

  // 1. Sembunyikan semua konten tab
  allTabs.forEach(function(t) {
    var el = document.getElementById('tab-' + t);
    if (el) {
      el.classList.add('hidden');
    }
  });

  // 2. Tampilkan konten tab yang dipilih
  var targetTab = document.getElementById('tab-' + tab);
  if (targetTab) {
    targetTab.classList.remove('hidden');
  }

  // 3. Perbarui warna navigasi tab utama
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

  // 4. Khusus tab Presensi, perbarui peta
  if (tab === 'presensi') {
    setTimeout(function() {
      if (typeof initMap === 'function') {
        initMap();
      }

      if (typeof map !== 'undefined' && map !== null) {
        map.invalidateSize();

        if (
          typeof currentLat !== 'undefined' &&
          typeof currentLng !== 'undefined' &&
          currentLat &&
          currentLng
        ) {
          map.setView([currentLat, currentLng], 17);
        }
      }
    }, 250);
  }

  // 5. Kembali ke posisi atas
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


// Navigasi & Logika Form Pengajuan Izin
function openPageIzin() {
  document.getElementById('izinJenisPage').value = '';
  document.getElementById('izinTglMulaiPage').value = '';
  document.getElementById('izinTglSelesaiPage').value = '';
  document.getElementById('izinAlasanPage').value = '';
  document.getElementById('izinLampiranPage').value = '';
  handleJenisIzinPageChange();
  switchTab('form-izin');
}

function handleJenisIzinPageChange() {
  var jenis = document.getElementById('izinJenisPage').value;
  var labelWajib = document.getElementById('labelWajibLampiranPage');
  if (labelWajib) {
    if (jenis === 'Sakit') {
      labelWajib.classList.remove('hidden');
    } else {
      labelWajib.classList.add('hidden');
    }
  }
}

async function submitPengajuanIzinPage() {
  var jenis = document.getElementById('izinJenisPage').value;
  var tglMulai = document.getElementById('izinTglMulaiPage').value;
  var tglSelesai = document.getElementById('izinTglSelesaiPage').value;
  var alasan = document.getElementById('izinAlasanPage').value;
  var fileInput = document.getElementById('izinLampiranPage');

  if (!jenis || !tglMulai || !tglSelesai || !alasan) {
    return alert('Harap lengkapi semua kolom yang wajib diisi!');
  }

  if (jenis === 'Sakit' && (!fileInput.files || fileInput.files.length === 0)) {
    return alert('Untuk izin Sakit, Anda wajib mengunggah Surat Dokter dalam format PDF!');
  }

  var base64Data = null;
  if (fileInput.files && fileInput.files.length > 0) {
    var file = fileInput.files[0];
    
    // Validasi Format PDF
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return alert('Format file tidak valid! Lampiran hanya menerima file berformat PDF.');
    }

    // Validasi Ukuran Maksimal 2 MB
    if (file.size > 2 * 1024 * 1024) {
      return alert('Ukuran file terlalu besar! Maksimal ukuran file adalah 2 MB.');
    }

    base64Data = await convertFileToBase64(file);
  }

  var btn = document.getElementById('btnSubmitIzinPage');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim Pengajuan...';

  var payload = {
    nip: currentUser.nip,
    nama: currentUser.nama,
    jenisIzin: jenis,
    tglMulai: tglMulai,
    tglSelesai: tglSelesai,
    alasan: alasan,
    lampiranBase64: base64Data
  };

  const res = await callGAS('submitIzin', { payload: payload });
  
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kirim Pengajuan Izin';

  if (res && res.success) {
    alert(res.message);
    switchTab('beranda');
    loadData();
  } else {
    alert(res ? res.message : 'Gagal mengirim pengajuan izin.');
  }
}

function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    var reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

function logout() {
  // Hapus sesi pengguna
  localStorage.removeItem('currentUser');
  sessionStorage.removeItem('currentUser');

  currentUser = null;

  // Hentikan kamera jika sedang aktif
  if (mediaStream) {
    mediaStream.getTracks().forEach(function(track) {
      track.stop();
    });
    mediaStream = null;
  }

  // Kembali ke halaman login dengan membersihkan tampilan lama
  window.location.replace('index.html');
}

var GAS_API_URL = "https://script.google.com/macros/s/AKfycbyjpa3M38gw53jiMJNUslPkBJz3lt2eGCyCMDn83gOavl1T6zq380jJRA3Lg-Y_XY4Q-w/exec"; 

function callGAS(actionName, payloadData) {
  return fetch(GAS_API_URL, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: actionName,
      payload: payloadData
    })
  })
  .then(function(response) {
    return response.json();
  })
  .catch(function(error) {
    console.error("Fetch Error pada " + actionName + ":", error);
    return { success: false, message: 'Koneksi ke server gagal: ' + error.toString() };
  });
}