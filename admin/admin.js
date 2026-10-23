
/**
 * JavaScript khusus halaman Admin Presensi PJLP.
 * Memerlukan api.js dimuat lebih dahulu di admin.html.
 */

var currentAdminUser = null;
var rawLogsData = [];
var masterPegawaiList = [];

// =====================================================
// 1. INISIALISASI HALAMAN ADMIN
// =====================================================

window.onload = function () {
  var now = new Date();
  var options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };

  document.getElementById('currentDateStr').innerText =
    now.toLocaleDateString('id-ID', options);

  // Ambil data pengguna yang tersimpan di browser.
  var savedUser = localStorage.getItem('currentUser');

  if (!savedUser) {
    window.location.replace('index.html');
    return;
  }

  try {
    currentAdminUser = JSON.parse(savedUser);
  } catch (e) {
    currentAdminUser = null;
  }

  // Pemeriksaan sisi browser untuk mengatur akses tampilan.
  // Validasi keamanan sebenarnya tetap harus dilakukan di backend.
  if (
    !currentAdminUser ||
    currentAdminUser.role !== 'ADMIN' ||
    !currentAdminUser._sessionExpiresAt ||
    Date.now() >= Number(currentAdminUser._sessionExpiresAt)
  ) {
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    window.location.replace('index.html');
    return;
  }

  document.getElementById('sideAdminNama').innerText =
    currentAdminUser.nama || 'Admin';

  document.getElementById('sideAdminNip').innerText =
    'NIP: ' + (currentAdminUser.nip || '-');

  fetchAdminData();
};


// =====================================================
// 2. MENGAMBIL DATA DASHBOARD DAN PEGAWAI
// =====================================================

async function fetchAdminData() {
  try {
    const res = await callGAS('getRekapData', {
      user: currentAdminUser
    });

    if (!res || res.success === false) {
      console.error(
        'Gagal mengambil data Admin:',
        res ? res.message : 'Tidak ada respons dari server.'
      );
      return;
    }

    rawLogsData = Array.isArray(res.logs) ? res.logs : [];
    masterPegawaiList = Array.isArray(res.totalPegawai)
      ? res.totalPegawai
      : [];

    document.getElementById('statTotalPegawai').innerText =
      masterPegawaiList.length;

    renderDashboardStatistik();
    renderTableMasterPegawai();

  } catch (error) {
    console.error('Kesalahan mengambil data Admin:', error);
  }
}


// =====================================================
// 3. RENDER STATISTIK DAN MONITORING PRESENSI HARI INI
// =====================================================

function renderDashboardStatistik() {
  var now = new Date();

  var todayStr =
    now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  var countHadir = 0;
  var countTerlambat = 0;
  var todayMap = {};

  rawLogsData.forEach(function (row) {
    if (row.tanggal === todayStr) {
      todayMap[row.nip] = row;

      if (
        row.statusKode === 'H' ||
        row.statusKode === 'H(PC)'
      ) {
        countHadir++;
      } else if (row.statusKode === 'H(T)') {
        countTerlambat++;
      }
    }
  });

  var totalPeg = masterPegawaiList.length;

  var countTidakHadir = Math.max(
    0,
    totalPeg - (countHadir + countTerlambat)
  );

  document.getElementById('statHadirHariIni').innerText =
    countHadir;

  document.getElementById('statTerlambatHariIni').innerText =
    countTerlambat;

  document.getElementById('statTidakHadirHariIni').innerText =
    countTidakHadir;

  var htmlTable = '';

  if (masterPegawaiList.length === 0) {
    htmlTable =
      '<tr>' +
        '<td colspan="7" class="p-6 text-center text-slate-400">' +
          'Belum ada data pegawai.' +
        '</td>' +
      '</tr>';
  } else {
    masterPegawaiList.forEach(function (peg) {
      var log = todayMap[peg.nip];

      var badgeHtml =
        '<span class="bg-rose-100 text-rose-800 border border-rose-200 ' +
        'text-[10px] font-extrabold px-2.5 py-1 rounded-full">' +
        'Belum Presensi</span>';

      var jamMasuk = '--:--:--';
      var jamPulang = '--:--:--';
      var ket = '-';

      if (log) {
        jamMasuk = log.jamMasuk || '--:--:--';
        jamPulang = log.jamPulang || '--:--:--';

        ket =
          (log.keterangan || '-') +
          ' (' + (log.jarak != null ? log.jarak : '-') + ')';

        if (
          log.statusKode === 'H' ||
          log.statusKode === 'H(PC)'
        ) {
          badgeHtml =
            '<span class="bg-emerald-100 text-emerald-800 ' +
            'border border-emerald-200 text-[10px] font-extrabold ' +
            'px-2.5 py-1 rounded-full">' +
            'Hadir Tepat Waktu</span>';

        } else if (log.statusKode === 'H(T)') {
          badgeHtml =
            '<span class="bg-amber-100 text-amber-800 ' +
            'border border-amber-200 text-[10px] font-extrabold ' +
            'px-2.5 py-1 rounded-full">' +
            'Terlambat</span>';
        }
      }

      htmlTable +=
        '<tr class="hover:bg-slate-50 transition">' +
          '<td class="p-4 font-bold text-slate-800">' +
            escapeAdminHtml(peg.nama) +
          '</td>' +

          '<td class="p-4 font-mono text-slate-600">' +
            escapeAdminHtml(peg.nip) +
          '</td>' +

          '<td class="p-4 text-slate-600">' +
            escapeAdminHtml(peg.shift) +
          '</td>' +

          '<td class="p-4 font-semibold text-slate-700">' +
            escapeAdminHtml(jamMasuk) +
          '</td>' +

          '<td class="p-4 font-semibold text-slate-700">' +
            escapeAdminHtml(jamPulang) +
          '</td>' +

          '<td class="p-4">' +
            badgeHtml +
          '</td>' +

          '<td class="p-4 text-slate-500 text-[11px]">' +
            escapeAdminHtml(ket) +
          '</td>' +
        '</tr>';
    });
  }

  document.getElementById('tableMonitoringHariIni').innerHTML =
    htmlTable;
}


// =====================================================
// 4. RENDER TABEL MASTER DATA PEGAWAI
// =====================================================

function renderTableMasterPegawai() {
  var html = '';

  if (masterPegawaiList.length === 0) {
    html =
      '<tr>' +
        '<td colspan="7" class="p-6 text-center text-slate-400">' +
          'Tidak ada data pegawai.' +
        '</td>' +
      '</tr>';

  } else {
    masterPegawaiList.forEach(function (peg) {
      html +=
        '<tr class="hover:bg-slate-50 transition">' +

          '<td class="p-4 font-mono text-slate-700 font-bold">' +
            escapeAdminHtml(peg.nip) +
          '</td>' +

          '<td class="p-4 font-bold text-slate-800">' +
            escapeAdminHtml(peg.nama) +
          '</td>' +

          '<td class="p-4 text-slate-600">' +
            'Pegawai PJLP' +
          '</td>' +

          '<td class="p-4 text-slate-600">-</td>' +

          '<td class="p-4">' +
            '<span class="bg-blue-50 text-blue-700 border border-blue-200 ' +
            'px-2.5 py-0.5 rounded-lg font-semibold">' +
            escapeAdminHtml(peg.shift) +
            '</span>' +
          '</td>' +

          '<td class="p-4 text-slate-600 font-medium">' +
            'PEGAWAI' +
          '</td>' +

          '<td class="p-4">' +
            '<span class="bg-emerald-100 text-emerald-800 ' +
            'border border-emerald-200 text-[10px] font-bold ' +
            'px-2 py-0.5 rounded-full">' +
            'Aktif</span>' +
          '</td>' +

        '</tr>';
    });
  }

  document.getElementById('tableMasterPegawai').innerHTML = html;
}


// =====================================================
// 5. PENCARIAN DATA PEGAWAI
// =====================================================

function filterPegawaiTable() {
  var input = document
    .getElementById('searchPegawaiInput')
    .value
    .toLowerCase();

  var rows = document.querySelectorAll(
    '#tableMasterPegawai tr'
  );

  rows.forEach(function (row) {
    var text = row.innerText.toLowerCase();

    row.style.display = text.includes(input) ? '' : 'none';
  });
}


// =====================================================
// 6. NAVIGASI MENU ADMIN
// =====================================================

function switchAdminMenu(menu) {
  var menuValid = ['dashboard', 'pegawai', 'settings'];

  if (!menuValid.includes(menu)) {
    return;
  }

  menuValid.forEach(function (m) {
    var sec = document.getElementById('section-' + m);

    if (sec) {
      sec.classList.add('hidden');
    }

    var btn = document.getElementById('menu-' + m);

    if (btn) {
      btn.className =
        'w-full flex items-center gap-3 px-4 py-3 rounded-xl ' +
        'transition text-slate-400 hover:bg-slate-800 hover:text-white';
    }
  });

  var activeSection = document.getElementById('section-' + menu);

  if (activeSection) {
    activeSection.classList.remove('hidden');
  }

  var activeBtn = document.getElementById('menu-' + menu);

  if (activeBtn) {
    activeBtn.className =
      'w-full flex items-center gap-3 px-4 py-3 rounded-xl ' +
      'transition bg-blue-600 text-white font-semibold shadow-md ' +
      'shadow-blue-600/20';
  }

  var titles = {
    dashboard: 'Dashboard & Statistik Presensi',
    pegawai: 'Manajemen Data Pegawai PJLP',
    settings: 'Pengaturan System & Lokasi Kantor'
  };

  document.getElementById('pageTitle').innerText =
    titles[menu] || 'Admin Dashboard';
}


// =====================================================
// 7. LOGOUT ADMIN
// =====================================================

function logoutAdmin() {
  localStorage.removeItem('currentUser');
  sessionStorage.removeItem('currentUser');

  window.location.replace('index.html');
}


// =====================================================
// 8. UTILITAS: ESCAPE TEKS HTML
// =====================================================

// Mencegah teks dari data pegawai ditafsirkan sebagai HTML.
function escapeAdminHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
