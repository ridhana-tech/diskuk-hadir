
/* =========================================================
 * ATASAN.JS
 * Dashboard Atasan - Presensi PJLP
 * ========================================================= */

var currentAtasanUser = null;
var rawAllLogsData = [];
var masterPegawaiList = [];
var currentFilterType = '1bulan';

/* =========================================================
 * INISIALISASI HALAMAN
 * ========================================================= */

window.onload = function () {
  var now = new Date();

  var dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  document.getElementById('tanggalHariIni').innerText = dateStr;

  document.getElementById('filterBulan').value = now.getMonth();
  document.getElementById('filterTahun').value = now.getFullYear();

  var savedUser = localStorage.getItem('currentUser');

  if (!savedUser) {
    window.location.replace('../index.html');
    return;
  }

  try {
    currentAtasanUser = JSON.parse(savedUser);
  } catch (e) {
    currentAtasanUser = null;
  }

  if (
    !currentAtasanUser ||
    currentAtasanUser.role !== 'ATASAN' ||
    !currentAtasanUser._sessionExpiresAt ||
    Date.now() >= Number(currentAtasanUser._sessionExpiresAt)
  ) {
    localStorage.removeItem('currentUser');
    window.location.replace('../index.html');
    return;
  }

  document.getElementById('headerNamaAtasan').innerText =
    currentAtasanUser.nama || '-';

  document.getElementById('headerJabatanAtasan').innerText =
    currentAtasanUser.jabatan || '-';

  document.getElementById('accNamaAtasan').innerText =
    currentAtasanUser.nama || '-';

  document.getElementById('accJabatanAtasan').innerText =
    currentAtasanUser.jabatan || '-';

  document.getElementById('accNipAtasan').innerText =
    'NIP: ' + (currentAtasanUser.nip || '-');

  document.getElementById('accNoHpAtasan').innerText =
    currentAtasanUser.noHp || '-';

  document.getElementById('accTtlAtasan').innerText =
    currentAtasanUser.ttl || '-';

  fetchAtasanData();
  loadDataApprovalAtasan();
};

/* =========================================================
 * MEMUAT DATA PRESENSI DAN REKAP
 * ========================================================= */

async function fetchAtasanData() {
  try {
    const res = await callGAS('getRekapData', {
      user: currentAtasanUser
    });

    if (!res) {
      tampilkanPesanRekap('Gagal memuat data presensi.');
      return;
    }

    rawAllLogsData = Array.isArray(res.logs) ? res.logs : [];
    masterPegawaiList = Array.isArray(res.totalPegawai)
      ? res.totalPegawai
      : [];

    populatePegawaiDropdown();
    renderBerandaSummaryHariIni();
    renderFilteredRekapSeluruhPegawai();

  } catch (error) {
    console.error('Gagal memuat data Atasan:', error);
    tampilkanPesanRekap('Terjadi kesalahan saat memuat data.');
  }
}

function tampilkanPesanRekap(pesan) {
  var container = document.getElementById('rekapSeluruhPegawaiList');

  if (container) {
    container.innerText = pesan;
  }
}

/* =========================================================
 * MEMUAT PENGAJUAN PERSETUJUAN DLDD
 * ========================================================= */

async function loadDataApprovalAtasan() {
  try {
    const res = await callGAS('getPendingApprovalData', {
      atasan: currentAtasanUser.nama
    });

    if (!res || !res.success) {
      document.getElementById('tabelApprovalList').innerHTML =
        '<tr><td colspan="5" class="p-4 text-center text-rose-500">' +
        'Gagal memuat pengajuan persetujuan.</td></tr>';
      return;
    }

    var pendingList = Array.isArray(res.data) ? res.data : [];

    document.getElementById('badgePendingCount').innerText =
      pendingList.length;

    document.getElementById('labelTotalPending').innerText =
      pendingList.length + ' Pengajuan';

    var tbody = document.getElementById('tabelApprovalList');
    tbody.innerHTML = '';

    if (pendingList.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="p-4 text-center text-slate-400">' +
        'Tidak ada pengajuan Dinas Luar yang menunggu.</td></tr>';
      return;
    }

    pendingList.forEach(function (item) {
      var tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50/50';

      var tdTanggal = document.createElement('td');
      tdTanggal.className = 'p-3';
      tdTanggal.appendChild(
        document.createTextNode(item.tanggal || '-')
      );

      var jam = document.createElement('span');
      jam.className = 'text-[10px] text-slate-400';
      jam.textContent = item.jamMasuk || '';
      tdTanggal.appendChild(document.createElement('br'));
      tdTanggal.appendChild(jam);

      var tdPegawai = document.createElement('td');
      tdPegawai.className = 'p-3 font-bold text-slate-800';

      var nama = document.createTextNode(item.nama || '-');
      tdPegawai.appendChild(nama);

      var nip = document.createElement('span');
      nip.className = 'text-[10px] font-normal text-slate-500';
      nip.textContent = item.nip || '-';

      tdPegawai.appendChild(document.createElement('br'));
      tdPegawai.appendChild(nip);

      var tdLokasi = document.createElement('td');
      tdLokasi.className = 'p-3';
      tdLokasi.textContent = item.keteranganLokasi || '-';

      var tdFoto = document.createElement('td');
      tdFoto.className = 'p-3';

      if (item.urlFoto) {
        var linkFoto = document.createElement('a');
        linkFoto.href = item.urlFoto;
        linkFoto.target = '_blank';
        linkFoto.rel = 'noopener noreferrer';
        linkFoto.className =
          'text-blue-600 font-semibold underline';
        linkFoto.textContent = 'Lihat Foto';
        tdFoto.appendChild(linkFoto);
      } else {
        tdFoto.textContent = '-';
      }

      var tdAksi = document.createElement('td');
      tdAksi.className = 'p-3 text-center space-x-1';

      var btnSetujui = document.createElement('button');
      btnSetujui.type = 'button';
      btnSetujui.className =
        'bg-emerald-600 hover:bg-emerald-700 text-white ' +
        'px-3 py-1.5 rounded-lg font-bold shadow-sm';
      btnSetujui.textContent = 'Setujui';
      btnSetujui.addEventListener('click', function () {
        prosesApproval(item.rowId, 'Disetujui');
      });

      var btnTolak = document.createElement('button');
      btnTolak.type = 'button';
      btnTolak.className =
        'bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 ' +
        'rounded-lg font-bold border border-red-200';
      btnTolak.textContent = 'Tolak';
      btnTolak.addEventListener('click', function () {
        prosesApproval(item.rowId, 'Ditolak');
      });

      tdAksi.appendChild(btnSetujui);
      tdAksi.appendChild(btnTolak);

      tr.appendChild(tdTanggal);
      tr.appendChild(tdPegawai);
      tr.appendChild(tdLokasi);
      tr.appendChild(tdFoto);
      tr.appendChild(tdAksi);

      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error('Gagal memuat pengajuan DLDD:', error);

    document.getElementById('tabelApprovalList').innerHTML =
      '<tr><td colspan="5" class="p-4 text-center text-rose-500">' +
      'Terjadi kesalahan saat memuat pengajuan.</td></tr>';
  }
}

/* =========================================================
 * PROSES PERSETUJUAN DLDD
 * ========================================================= */

async function prosesApproval(rowId, statusKeputusan) {
  if (!rowId) {
    alert('ID pengajuan tidak ditemukan.');
    return;
  }

  if (
    statusKeputusan !== 'Disetujui' &&
    statusKeputusan !== 'Ditolak'
  ) {
    alert('Status persetujuan tidak valid.');
    return;
  }

  if (
    !confirm(
      'Apakah Anda yakin ingin mengubah status presensi ini menjadi ' +
      statusKeputusan + '?'
    )
  ) {
    return;
  }

  try {
    const res = await callGAS('updateStatusApproval', {
      rowId: rowId,
      status: statusKeputusan
    });

    if (res && res.success) {
      alert(res.message || 'Status persetujuan berhasil diperbarui.');

      await loadDataApprovalAtasan();
      await fetchAtasanData();

    } else {
      alert(
        'Gagal memperbarui status: ' +
        ((res && res.message) || 'Kesalahan sistem')
      );
    }

  } catch (error) {
    console.error('Gagal memproses persetujuan:', error);
    alert('Terjadi kesalahan saat memproses persetujuan.');
  }
}

/* =========================================================
 * LOGOUT
 * ========================================================= */

function logoutAtasan() {
  localStorage.removeItem('currentUser');
  sessionStorage.removeItem('currentUser');

  window.location.replace('../index.html');
}

/* =========================================================
 * DROPDOWN PEGAWAI
 * ========================================================= */

function populatePegawaiDropdown() {
  var selectEl = document.getElementById('filterNamaPegawai');

  selectEl.innerHTML = '';

  var optionSemua = document.createElement('option');
  optionSemua.value = 'ALL';
  optionSemua.textContent = '-- Semua Pegawai --';
  selectEl.appendChild(optionSemua);

  masterPegawaiList.forEach(function (peg) {
    var option = document.createElement('option');
    option.value = String(peg.nip || '');
    option.textContent =
      (peg.nama || '-') + ' (' + (peg.nip || '-') + ')';

    selectEl.appendChild(option);
  });
}

/* =========================================================
 * RINGKASAN PRESENSI HARI INI
 * ========================================================= */

function renderBerandaSummaryHariIni() {
  var now = new Date();

  var todayStr =
    now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  var countHadir = 0;
  var countTerlambat = 0;
  var todayLogsMap = {};

  rawAllLogsData.forEach(function (row) {
    if (String(row.tanggal || '').slice(0, 10) === todayStr) {
      todayLogsMap[String(row.nip)] = row;

      if (row.statusKode === 'H' || row.statusKode === 'H(PC)') {
        countHadir++;
      } else if (row.statusKode === 'H(T)') {
        countTerlambat++;
      }
    }
  });

  var totalPegawai = masterPegawaiList.length;

  var countTidakHadir = Math.max(
    0,
    totalPegawai - countHadir - countTerlambat
  );

  document.getElementById('cardHadirHariIni').innerText = countHadir;
  document.getElementById('cardTerlambatHariIni').innerText =
    countTerlambat;
  document.getElementById('cardTidakHadirHariIni').innerText =
    countTidakHadir;
  document.getElementById('totalPegawaiCount').innerText =
    'Total: ' + totalPegawai + ' Pegawai';

  var container = document.getElementById('listPresensiHariIni');
  container.innerHTML = '';

  if (masterPegawaiList.length === 0) {
    container.innerHTML =
      '<p class="text-xs text-center text-slate-400 py-3">' +
      'Belum ada data pegawai.</p>';
    return;
  }

  masterPegawaiList.forEach(function (peg) {
    var log = todayLogsMap[String(peg.nip)];

    var statusText = 'Belum Presensi';
    var badgeClass =
      'bg-rose-100 text-rose-800 border border-rose-200';
    var jamInfo = '--:--:--';

    if (log) {
      jamInfo = 'Masuk: ' + (log.jamMasuk || '--:--:--');

      if (log.statusKode === 'H' || log.statusKode === 'H(PC)') {
        statusText = 'Hadir';
        badgeClass =
          'bg-emerald-100 text-emerald-800 border border-emerald-200';
      } else if (log.statusKode === 'H(T)') {
        statusText = 'Terlambat';
        badgeClass =
          'bg-amber-100 text-amber-800 border border-amber-200';
      }
    }

    var card = document.createElement('div');
    card.className =
      'flex justify-between items-center p-3 rounded-xl ' +
      'bg-slate-50 border border-slate-100';

    var info = document.createElement('div');

    var nama = document.createElement('p');
    nama.className = 'font-bold text-slate-800 text-xs';
    nama.textContent = peg.nama || '-';

    var detail = document.createElement('p');
    detail.className = 'text-[10px] text-slate-400';
    detail.textContent =
      'NIP: ' + (peg.nip || '-') + ' | ' + jamInfo;

    info.appendChild(nama);
    info.appendChild(detail);

    var badge = document.createElement('span');
    badge.className =
      badgeClass + ' text-[10px] font-extrabold px-2.5 py-0.5 rounded-full';
    badge.textContent = statusText;

    card.appendChild(info);
    card.appendChild(badge);
    container.appendChild(card);
  });
}

/* =========================================================
 * MODAL FILTER BULAN DAN TAHUN
 * ========================================================= */

function openModalFilterBulanTahun() {
  document.getElementById('modalFilterBulanTahun')
    .classList.remove('hidden');
}

function closeModalFilterBulanTahun() {
  document.getElementById('modalFilterBulanTahun')
    .classList.add('hidden');
}

/* =========================================================
 * FILTER CEPAT
 * ========================================================= */

function setQuickFilter(type) {
  currentFilterType = type;

  var btnBulan = document.getElementById('btnFilterBulan');
  var btnMingguIni = document.getElementById('btnFilterMingguIni');
  var btnMingguLalu = document.getElementById('btnFilterMingguLalu');
  var btnIcon = document.getElementById('btnFilterIcon');

  btnBulan.className =
    'flex-1 py-1.5 rounded-lg text-slate-600 transition';

  btnMingguIni.className =
    'flex-1 py-1.5 rounded-lg text-slate-600 transition';

  btnMingguLalu.className =
    'flex-1 py-1.5 rounded-lg text-slate-600 transition';

  btnIcon.className =
    'w-8 h-8 rounded-lg bg-slate-200/80 hover:bg-slate-300 ' +
    'text-slate-700 flex items-center justify-center transition shrink-0';

  if (type === '1bulan') {
    btnBulan.className =
      'flex-1 py-1.5 rounded-lg bg-white text-blue-700 ' +
      'font-bold shadow-sm transition';
  }

  if (type === '1minggu_ini') {
    btnMingguIni.className =
      'flex-1 py-1.5 rounded-lg bg-white text-blue-700 ' +
      'font-bold shadow-sm transition';
  }

  if (type === '1minggu_lalu') {
    btnMingguLalu.className =
      'flex-1 py-1.5 rounded-lg bg-white text-blue-700 ' +
      'font-bold shadow-sm transition';
  }

  renderFilteredRekapSeluruhPegawai();
}

/* =========================================================
 * FILTER BULAN DAN TAHUN KUSTOM
 * ========================================================= */

function applyCustomMonthYearFilter() {
  currentFilterType = 'custom';

  var btnBulan = document.getElementById('btnFilterBulan');
  var btnMingguIni = document.getElementById('btnFilterMingguIni');
  var btnMingguLalu = document.getElementById('btnFilterMingguLalu');
  var btnIcon = document.getElementById('btnFilterIcon');

  btnBulan.className =
    'flex-1 py-1.5 rounded-lg text-slate-600 transition';

  btnMingguIni.className =
    'flex-1 py-1.5 rounded-lg text-slate-600 transition';

  btnMingguLalu.className =
    'flex-1 py-1.5 rounded-lg text-slate-600 transition';

  btnIcon.className =
    'w-8 h-8 rounded-lg bg-blue-700 text-white font-bold ' +
    'shadow-sm flex items-center justify-center transition shrink-0';

  closeModalFilterBulanTahun();
  renderFilteredRekapSeluruhPegawai();
}

/* =========================================================
 * RENDER REKAP PRESENSI
 * ========================================================= */

function renderFilteredRekapSeluruhPegawai() {
  var container = document.getElementById('rekapSeluruhPegawaiList');

  if (!rawAllLogsData || rawAllLogsData.length === 0) {
    container.innerHTML =
      '<p class="text-xs text-center text-slate-400 py-4">' +
      'Belum ada data presensi pegawai.</p>';
    return;
  }

  var now = new Date();
  var selectedBulan = parseInt(
    document.getElementById('filterBulan').value,
    10
  );
  var selectedTahun = parseInt(
    document.getElementById('filterTahun').value,
    10
  );
  var selectedNipFilter =
    document.getElementById('filterNamaPegawai').value;

  // Gunakan tanggal acuan terpisah agar filter tidak mengubah "now".
  var startDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  var endDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  if (currentFilterType === '1minggu_ini') {
    var day = startDate.getDay();
    var diffToMonday = day === 0 ? -6 : 1 - day;

    startDate.setDate(startDate.getDate() + diffToMonday);
    startDate.setHours(0, 0, 0, 0);

    endDate.setHours(23, 59, 59, 999);

  } else if (currentFilterType === '1minggu_lalu') {
    var dayLalu = startDate.getDay();
    var diffToMondayLalu = (dayLalu === 0 ? -6 : 1 - dayLalu) - 7;

    startDate.setDate(startDate.getDate() + diffToMondayLalu);
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  }

  var filtered = rawAllLogsData.filter(function (row) {
    var nip = String(row.nip || '').trim();

    var matchPegawai =
      selectedNipFilter === 'ALL' ||
      nip === String(selectedNipFilter).trim();

    if (!matchPegawai) return false;

    var rowDate = parseTanggalPresensi(row.tanggal);
    if (!rowDate) return false;

    if (currentFilterType === '1bulan') {
      return (
        rowDate.getMonth() === now.getMonth() &&
        rowDate.getFullYear() === now.getFullYear()
      );
    }

    if (currentFilterType === '1minggu_ini') {
      return rowDate >= startDate && rowDate <= endDate;
    }

    if (currentFilterType === '1minggu_lalu') {
      return rowDate >= startDate && rowDate <= endDate;
    }

    if (currentFilterType === 'custom') {
      return (
        rowDate.getMonth() === selectedBulan &&
        rowDate.getFullYear() === selectedTahun
      );
    }

    return true;
  });

  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML =
      '<p class="text-xs text-center text-slate-400 py-4">' +
      'Tidak ada catatan presensi pada filter ini.</p>';
    return;
  }

  filtered.forEach(function (row) {
    var isLiburRow = row.statusKode === 'LIBUR';

    var badgeColor =
      'bg-emerald-100 text-emerald-800 border-emerald-200';

    if (row.statusKode === 'H(T)') {
      badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
    }

    if (row.statusKode === 'H(PC)') {
      badgeColor = 'bg-purple-100 text-purple-800 border-purple-200';
    }

    if (row.statusKode === 'H(TAP)') {
      badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
    }

    if (isLiburRow) {
      badgeColor = 'bg-red-100 text-red-800 border-red-200';
    }

    var textClass = isLiburRow
      ? 'text-red-600 font-extrabold'
      : 'text-slate-700 font-bold';

    var card = document.createElement('div');
    card.className =
      'bg-white p-4 rounded-2xl border border-slate-200 ' +
      'shadow-sm space-y-2.5';

    var header = document.createElement('div');
    header.className =
      'flex justify-between items-start border-b border-slate-100 pb-2';

    var identity = document.createElement('div');

    var nama = document.createElement('h4');
    nama.className = 'font-bold text-slate-800 text-xs';
    nama.textContent = row.nama || '-';

    var tanggal = document.createElement('p');
    tanggal.className = 'text-[10px] text-slate-400';
    tanggal.textContent =
      'NIP: ' + (row.nip || '-') + ' | ' +
      (row.tanggalPretty || row.tanggal || '-');

    identity.appendChild(nama);
    identity.appendChild(tanggal);

    var status = document.createElement('span');
    status.className =
      badgeColor + ' border text-[10px] font-extrabold ' +
      'px-2.5 py-0.5 rounded-full';
    status.textContent = row.statusKode || '-';

    header.appendChild(identity);
    header.appendChild(status);

    var jamGrid = document.createElement('div');
    jamGrid.className = 'grid grid-cols-2 gap-2 text-xs py-0.5';

    var jamMasuk = document.createElement('div');

    var labelMasuk = document.createElement('span');
    labelMasuk.className = 'text-slate-400 block text-[10px]';
    labelMasuk.textContent = 'Jam Masuk';

    var valueMasuk = document.createElement('span');
    valueMasuk.className = textClass;
    valueMasuk.textContent = row.jamMasuk || '-';

    jamMasuk.appendChild(labelMasuk);
    jamMasuk.appendChild(valueMasuk);

    var jamPulang = document.createElement('div');
    jamPulang.className = 'text-right';

    var labelPulang = document.createElement('span');
    labelPulang.className = 'text-slate-400 block text-[10px]';
    labelPulang.textContent = 'Jam Pulang';

    var valuePulang = document.createElement('span');
    valuePulang.className = textClass;
    valuePulang.textContent = row.jamPulang || '-';

    jamPulang.appendChild(labelPulang);
    jamPulang.appendChild(valuePulang);

    jamGrid.appendChild(jamMasuk);
    jamGrid.appendChild(jamPulang);

    var lokasi = document.createElement('div');
    lokasi.className =
      'flex justify-between items-center text-[10px] ' +
      'text-slate-500 pt-1.5 border-t border-slate-100';

    var lokasiText = document.createElement('span');

    var lokasiIcon = document.createElement('i');
    lokasiIcon.className =
      'fa-solid fa-location-dot text-red-500 mr-1';

    lokasiText.appendChild(lokasiIcon);
    lokasiText.appendChild(
      document.createTextNode(
        (row.keterangan || '-') + ' (' + (row.jarak || '-') + ')'
      )
    );

    lokasi.appendChild(lokasiText);

    card.appendChild(header);
    card.appendChild(jamGrid);
    card.appendChild(lokasi);

    container.appendChild(card);
  });
}

/* =========================================================
 * PARSING TANGGAL PRESENSI
 * ========================================================= */

function parseTanggalPresensi(value) {
  if (!value) return null;

  // Format ISO: YYYY-MM-DD atau YYYY-MM-DDTHH:mm:ss
  var text = String(value).trim();
  var isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return new Date(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3])
    );
  }

  var parsed = new Date(value);

  if (isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  );
}

/* =========================================================
 * NAVIGASI TAB ATASAN
 * ========================================================= */

function switchTabAtasan(tab) {
  var tabs = ['beranda', 'rekap', 'akun'];

  if (tabs.indexOf(tab) === -1) return;

  tabs.forEach(function (t) {
    var el = document.getElementById('tab-' + t);
    if (el) el.classList.add('hidden');

    var nav = document.getElementById('nav-' + t);

    if (nav) {
      nav.className =
        'flex flex-col items-center justify-center text-slate-400';
    }
  });

  var activeTab = document.getElementById('tab-' + tab);
  var activeNav = document.getElementById('nav-' + tab);

  if (activeTab) activeTab.classList.remove('hidden');

  if (activeNav) {
    activeNav.className =
      'flex flex-col items-center justify-center text-blue-700';
  }
}
