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

// ==================== INITIALIZATION ====================
window.onload = function() {
  var savedUser = localStorage.getItem('currentUser');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      if (currentUser.role === 'ATASAN') {
        window.location.href = 'atasan.html';
        return;
      } else if (currentUser.role === 'ADMIN') {
        window.location.href = 'admin.html';
        return;
      }
      initAppWithUser(currentUser);
    } catch (e) {
      console.error("Gagal parse user:", e);
    }
  }
  startGpsTracking();
};

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
  document.getElementById('pageLogin').classList.add('hidden');
  document.getElementById('pagePegawai').classList.remove('hidden');
  
  document.getElementById('headerNama').innerText = user.nama;
  document.getElementById('headerInfo').innerText = 'NIP: ' + user.nip + ' | Shift: ' + user.shift;
  
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

function setQuickFilter(type) {
  currentFilterType = type;

  var btnBulan = document.getElementById('btnFilterBulan');
  var btnMingguIni = document.getElementById('btnFilterMingguIni');
  var btnMingguLalu = document.getElementById('btnFilterMingguLalu');
  var btnIcon = document.getElementById('btnFilterIcon');

  btnBulan.className = "flex-1 py-2 rounded-xl text-slate-600 transition";
  btnMingguIni.className = "flex-1 py-2 rounded-xl text-slate-600 transition";
  btnMingguLalu.className = "flex-1 py-2 rounded-xl text-slate-600 transition";
  btnIcon.className = "w-9 h-9 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition shrink-0";

  if (type === '1bulan') btnBulan.className = "flex-1 py-2 rounded-xl bg-white text-blue-700 font-bold shadow-sm transition";
  if (type === '1minggu_ini') btnMingguIni.className = "flex-1 py-2 rounded-xl bg-white text-blue-700 font-bold shadow-sm transition";
  if (type === '1minggu_lalu') btnMingguLalu.className = "flex-1 py-2 rounded-xl bg-white text-blue-700 font-bold shadow-sm transition";

  renderFilteredRekap();
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

function renderFilteredRekap() {
  if (!rawLogsData || rawLogsData.length === 0) {
    document.getElementById('rekapPegawaiHarian').innerHTML = '<p class="text-xs text-center text-slate-400 py-4">Belum ada catatan presensi.</p>';
    return;
  }

  var now = new Date();
  var selectedBulan = parseInt(document.getElementById('filterBulan').value, 10);
  var selectedTahun = parseInt(document.getElementById('filterTahun').value, 10);

  var filtered = rawLogsData.filter(function(row) {
    var rowDate = new Date(row.tanggal);

    if (currentFilterType === '1bulan') {
      return rowDate.getMonth() === now.getMonth() && rowDate.getFullYear() === now.getFullYear();
    } else if (currentFilterType === '1minggu_ini') {
      var day = now.getDay();
      var diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
      var monday = new Date(now.setDate(diffToMon));
      monday.setHours(0,0,0,0);
      return rowDate >= monday;
    } else if (currentFilterType === '1minggu_lalu') {
      var dayLalu = now.getDay();
      var diffToMonLalu = now.getDate() - dayLalu + (dayLalu === 0 ? -6 : 1) - 7;
      var monLalu = new Date(now.setDate(diffToMonLalu));
      monLalu.setHours(0,0,0,0);
      var sunLalu = new Date(monLalu);
      sunLalu.setDate(sunLalu.getDate() + 6);
      sunLalu.setHours(23,59,59,999);
      return rowDate >= monLalu && rowDate <= sunLalu;
    } else if (currentFilterType === 'custom') {
      return rowDate.getMonth() === selectedBulan && rowDate.getFullYear() === selectedTahun;
    }
    return true;
  });

  var htmlHarian = '';
  filtered.forEach(function(row) {
    var isLiburRow = (row.statusKode === 'LIBUR');
    var badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (row.statusKode === 'H(T)') badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
    if (row.statusKode === 'H(PC)') badgeColor = 'bg-purple-100 text-purple-800 border-purple-200';
    if (row.statusKode === 'H(TAP)') badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
    if (isLiburRow) badgeColor = 'bg-red-100 text-red-800 border-red-200';

    var textClass = isLiburRow ? 'text-red-600 font-extrabold' : 'text-slate-700 font-bold';

    htmlHarian += '<div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">' +
      '<div class="flex justify-between items-center border-b border-slate-100 pb-2">' +
        '<span class="font-bold text-slate-800 text-xs">' + (row.tanggalPretty || row.tanggal) + '</span>' +
        '<span class="' + badgeColor + ' border text-[10px] font-extrabold px-2.5 py-0.5 rounded-full" title="' + row.statusText + '">' + row.statusKode + '</span>' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-2 text-xs py-1">' +
        '<div><span class="text-slate-400 block text-[10px]">Jam Masuk</span><span class="' + textClass + '">' + row.jamMasuk + '</span></div>' +
        '<div class="text-right"><span class="text-slate-400 block text-[10px]">Jam Pulang</span><span class="' + textClass + '">' + row.jamPulang + '</span></div>' +
      '</div>' +
      '<div class="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-100">' +
        '<span><i class="fa-solid fa-location-dot text-red-500 mr-1"></i>' + row.keterangan + ' (' + row.jarak + ')</span>' +
      '</div>' +
    '</div>';
  });

  document.getElementById('rekapPegawaiHarian').innerHTML = htmlHarian || '<p class="text-xs text-center text-slate-400 py-4">Tidak ada data presensi pada periode ini.</p>';
}

async function loadData() {
  if (!currentUser) return;

  const res = await callGAS('getRekapData', { user: currentUser });
  if (!res) return;

  rawLogsData = res.logs || [];
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

  var currentMonthIdx = now.getMonth();
  var currentYear = now.getFullYear();
  var htmlLogbook = '';

  for (var m = currentMonthIdx; m >= 0; m--) {
    var bulanName = namaBulanIndo[m];
    var isCurrentMonth = (m === currentMonthIdx);

    var existingFile = uploadedLogbookList.find(function(item) {
      return item.bulan === bulanName && item.tahun.toString() === currentYear.toString();
    });

    htmlLogbook += '<div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">' +
      '<div>' +
        '<p class="font-bold text-slate-800 text-xs">Logbook ' + bulanName + ' ' + currentYear + '</p>' +
        '<p class="text-[10px] text-slate-400">' + (isCurrentMonth ? 'Bulan Berjalan' : 'Bulan Lalu') + '</p>' +
      '</div>';

    if (existingFile && existingFile.fileUrl) {
      htmlLogbook += '<div class="flex items-center gap-1.5">' +
        '<a href="' + existingFile.fileUrl + '" target="_blank" class="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl font-bold text-xs border border-blue-200 flex items-center gap-1">' +
          '<i class="fa-solid fa-file-pdf"></i> Lihat' +
        '</a>';
      if (isCurrentMonth) {
        htmlLogbook += '<button type="button" onclick="openModalUpload(\'' + bulanName + '\', ' + currentYear + ')" class="bg-amber-50 text-amber-700 px-2.5 py-1.5 rounded-xl font-bold text-xs border border-amber-200">' +
          '<i class="fa-solid fa-pen-to-square"></i>' +
        '</button>';
      }
      htmlLogbook += '</div>';
    } else {
      if (isCurrentMonth) {
        htmlLogbook += '<button type="button" onclick="openModalUpload(\'' + bulanName + '\', ' + currentYear + ')" class="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1">' +
          '<i class="fa-solid fa-cloud-arrow-up"></i> Upload' +
        '</button>';
      } else {
        htmlLogbook += '<span class="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">Tidak Diunggah</span>';
      }
    }

    htmlLogbook += '</div>';
  }

  document.getElementById('logbookList').innerHTML = htmlLogbook;
}

function switchTab(tab) {
  activeTab = tab;
  ['beranda', 'rekap', 'presensi', 'logbook', 'akun'].forEach(function(t) {
    var el = document.getElementById('tab-' + t);
    if (el) el.classList.add('hidden');
    var nav = document.getElementById('nav-' + t);
    if (nav && t !== 'presensi') nav.className = "flex flex-col items-center justify-center text-slate-400";
  });

  // Tampilkan tab target
  var targetTab = document.getElementById('tab-' + tab);
  if (targetTab) {
    targetTab.classList.remove('hidden');
  }

  var activeNav = document.getElementById('nav-' + tab);
  if (activeNav && tab !== 'presensi') {
    activeNav.className = "flex flex-col items-center justify-center text-blue-700";
  }

  // Khusus tab presensi: Berikan jeda agar DOM selesai dirender, lalu muat/perbarui peta
  if (tab === 'presensi') {
    setTimeout(function() {
      if (typeof initMap === 'function') {
        initMap();
      }
      if (typeof map !== 'undefined' && map !== null) {
        map.invalidateSize(); // Paksa Leaflet menyesuaikan ukuran peta dengan kontainer layar
        if (typeof currentLat !== 'undefined' && typeof currentLng !== 'undefined' && currentLat && currentLng) {
          map.setView([currentLat, currentLng], 17);
        }
      }
    }, 300);
  }
}