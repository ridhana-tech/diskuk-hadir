
/* ==========================================
   PRESENSI PJLP - JAVASCRIPT ADMIN
   Memerlukan api.js dimuat lebih dahulu.
========================================== */

var currentAdminUser = null;
var rawLogsData = [];
var masterPegawaiList = [];

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

  var savedUser = localStorage.getItem('currentUser');

  if (!savedUser) {
    window.location.replace('../index.html');
    return;
  }

  try {
    currentAdminUser = JSON.parse(savedUser);
  } catch (e) {
    currentAdminUser = null;
  }

  if (
    !currentAdminUser ||
    currentAdminUser.role !== 'ADMIN' ||
    !currentAdminUser._sessionExpiresAt ||
    !currentAdminUser.token ||
    Date.now() >= Number(currentAdminUser._sessionExpiresAt)
  ) {
    localStorage.removeItem('currentUser');
    window.location.replace('../index.html');
    return;
  }

  document.getElementById('sideAdminNama').innerText =
    currentAdminUser.nama || '-';
  document.getElementById('sideAdminNip').innerText =
    'NIP: ' + (currentAdminUser.nip || '-');

  fetchAdminData();
};

async function fetchAdminData() {
  try {
    const res = await callGAS('getRekapData', {
      user: currentAdminUser
    });

    if (!res || res.success === false) {
      throw new Error(
        (res && res.message) || 'Data dashboard gagal dimuat.'
      );
    }

    rawLogsData = res.logs || [];
    masterPegawaiList = res.totalPegawai || [];

    document.getElementById('statTotalPegawai').innerText =
      masterPegawaiList.length;

    renderDashboardStatistik();
    renderTableMasterPegawai();
  } catch (error) {
    console.error('Gagal memuat data Admin:', error);

    var monitoring = document.getElementById('tableMonitoringHariIni');
    var master = document.getElementById('tableMasterPegawai');

    if (monitoring) {
      monitoring.innerHTML =
        '<tr><td colspan="7" class="p-6 text-center text-rose-500">' +
        'Gagal memuat data presensi.</td></tr>';
    }

    if (master) {
      master.innerHTML =
        '<tr><td colspan="7" class="p-6 text-center text-rose-500">' +
        'Gagal memuat data pegawai.</td></tr>';
    }
  }
}

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
    if (String(row.tanggal || '').slice(0, 10) === todayStr) {
      todayMap[String(row.nip)] = row;

      if (row.statusKode === 'H' || row.statusKode === 'H(PC)') {
        countHadir++;
      } else if (row.statusKode === 'H(T)') {
        countTerlambat++;
      }
    }
  });

  var totalPeg = masterPegawaiList.length;
  var countTidakHadir = Math.max(
    0,
    totalPeg - countHadir - countTerlambat
  );

  document.getElementById('statHadirHariIni').innerText = countHadir;
  document.getElementById('statTerlambatHariIni').innerText =
    countTerlambat;
  document.getElementById('statTidakHadirHariIni').innerText =
    countTidakHadir;

  var htmlTable = '';

  if (masterPegawaiList.length === 0) {
    htmlTable =
      '<tr><td colspan="7" class="p-6 text-center text-slate-400">' +
      'Belum ada data pegawai.</td></tr>';
  } else {
    masterPegawaiList.forEach(function (peg) {
      var log = todayMap[String(peg.nip)];

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
          (log.keterangan || '-') + ' (' + (log.jarak || '-') + ')';

        if (log.statusKode === 'H' || log.statusKode === 'H(PC)') {
          badgeHtml =
            '<span class="bg-emerald-100 text-emerald-800 border ' +
            'border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 ' +
            'rounded-full">Hadir Tepat Waktu</span>';
        } else if (log.statusKode === 'H(T)') {
          badgeHtml =
            '<span class="bg-amber-100 text-amber-800 border ' +
            'border-amber-200 text-[10px] font-extrabold px-2.5 py-1 ' +
            'rounded-full">Terlambat</span>';
        }
      }

      htmlTable +=
        '<tr class="hover:bg-slate-50 transition">' +
        '<td class="p-4 font-bold text-slate-800">' +
        escapeHtml(peg.nama) + '</td>' +
        '<td class="p-4 font-mono text-slate-600">' +
        escapeHtml(peg.nip) + '</td>' +
        '<td class="p-4 text-slate-600">' +
        escapeHtml(peg.shift) + '</td>' +
        '<td class="p-4 font-semibold text-slate-700">' +
        escapeHtml(jamMasuk) + '</td>' +
        '<td class="p-4 font-semibold text-slate-700">' +
        escapeHtml(jamPulang) + '</td>' +
        '<td class="p-4">' + badgeHtml + '</td>' +
        '<td class="p-4 text-slate-500 text-[11px]">' +
        escapeHtml(ket) + '</td>' +
        '</tr>';
    });
  }

  document.getElementById('tableMonitoringHariIni').innerHTML = htmlTable;
}

function renderTableMasterPegawai() {
  var html = '';

  if (masterPegawaiList.length === 0) {
    html =
      '<tr><td colspan="7" class="p-6 text-center text-slate-400">' +
      'Tidak ada data pegawai.</td></tr>';
  } else {
    masterPegawaiList.forEach(function (peg) {
      html +=
        '<tr class="hover:bg-slate-50 transition">' +
        '<td class="p-4 font-mono text-slate-700 font-bold">' +
        escapeHtml(peg.nip) + '</td>' +
        '<td class="p-4 font-bold text-slate-800">' +
        escapeHtml(peg.nama) + '</td>' +
        '<td class="p-4 text-slate-600">' +
        escapeHtml(peg.jabatan || 'Pegawai PJLP') + '</td>' +
        '<td class="p-4 text-slate-600">' +
        escapeHtml(peg.noHp || '-') + '</td>' +
        '<td class="p-4">' +
        '<span class="bg-blue-50 text-blue-700 border border-blue-200 ' +
        'px-2.5 py-0.5 rounded-lg font-semibold">' +
        escapeHtml(peg.shift) + '</span></td>' +
        '<td class="p-4 text-slate-600 font-medium">' +
        escapeHtml(peg.role || 'PEGAWAI') + '</td>' +
        '<td class="p-4">' +
        '<span class="bg-emerald-100 text-emerald-800 border ' +
        'border-emerald-200 text-[10px] font-bold px-2 py-0.5 ' +
        'rounded-full">' +
        escapeHtml(peg.status || 'Aktif') + '</span></td>' +
        '</tr>';
    });
  }

  document.getElementById('tableMasterPegawai').innerHTML = html;
}

function filterPegawaiTable() {
  var inputEl = document.getElementById('searchPegawaiInput');
  if (!inputEl) return;

  var input = inputEl.value.toLowerCase();
  var rows = document.querySelectorAll('#tableMasterPegawai tr');

  rows.forEach(function (row) {
    var text = row.innerText.toLowerCase();
    row.style.display = text.includes(input) ? '' : 'none';
  });
}

function switchAdminMenu(menu) {
  ['dashboard', 'pegawai', 'settings'].forEach(function (m) {
    var sec = document.getElementById('section-' + m);
    if (sec) sec.classList.add('hidden');

    var btn = document.getElementById('menu-' + m);
    if (btn) {
      btn.className =
        'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ' +
        'text-slate-400 hover:bg-slate-800 hover:text-white';
    }
  });

  var targetSection = document.getElementById('section-' + menu);
  if (targetSection) targetSection.classList.remove('hidden');

  var activeBtn = document.getElementById('menu-' + menu);
  if (activeBtn) {
    activeBtn.className =
      'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ' +
      'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20';
  }

  var titles = {
    dashboard: 'Dashboard & Statistik Presensi',
    pegawai: 'Manajemen Data Pegawai PJLP',
    settings: 'Pengaturan Sistem & Lokasi Kantor'
  };

  var titleEl = document.getElementById('pageTitle');
  if (titleEl) {
    titleEl.innerText = titles[menu] || 'Admin Dashboard';
  }
}

function logoutAdmin() {
  if (
    currentAdminUser &&
    currentAdminUser.token &&
    typeof callGAS === 'function'
  ) {
    callGAS('logout', {}).catch(function (err) {
      console.warn('Logout server gagal:', err);
    });
  }

  localStorage.removeItem('currentUser');
  sessionStorage.removeItem('currentUser');
  window.location.replace('../index.html');
}

/* Mencegah teks dari data server diperlakukan sebagai HTML. */
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
