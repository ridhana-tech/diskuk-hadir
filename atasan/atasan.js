
var currentAtasanUser = null;
var rawAllLogsData = [];
var masterPegawaiList = [];
var currentFilterType = '1bulan';

window.addEventListener('load', function () {
  var now = new Date();
  var dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  document.getElementById('tanggalHariIni').innerText = dateStr;
  document.getElementById('filterBulan').value = now.getMonth();

  var yearSelect = document.getElementById('filterTahun');
  var currentYear = String(now.getFullYear());

  if (!Array.from(yearSelect.options).some(function (option) {
    return option.value === currentYear;
  })) {
    var yearOption = document.createElement('option');
    yearOption.value = currentYear;
    yearOption.textContent = currentYear;
    yearSelect.insertBefore(yearOption, yearSelect.firstChild);
  }

  yearSelect.value = currentYear;

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
    !currentAtasanUser.token ||
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
});

async function fetchAtasanData() {
  try {
    const res = await callGAS('getRekapData', {
      user: currentAtasanUser
    });

    if (res && res.success !== false) {
      rawAllLogsData = res.logs || [];
      masterPegawaiList = res.totalPegawai || [];

      populatePegawaiDropdown();
      renderBerandaSummaryHariIni();
      renderFilteredRekapSeluruhPegawai();
    } else {
      throw new Error(
        (res && res.message) || 'Data presensi tidak dapat dimuat.'
      );
    }
  } catch (error) {
    console.error('Gagal memuat data Atasan:', error);

    document.getElementById('listPresensiHariIni').textContent =
      'Gagal memuat data presensi.';
    document.getElementById('rekapSeluruhPegawaiList').textContent =
      'Gagal memuat rekap presensi.';
  }
}

async function loadDataApprovalAtasan() {
  try {
    const res = await callGAS('getPendingApprovalData', {
      atasan: currentAtasanUser.nama
    });

    if (!res || !res.success) {
      throw new Error(
        (res && res.message) || 'Data persetujuan tidak dapat dimuat.'
      );
    }

    var pendingList = res.data || [];

    document.getElementById('badgePendingCount').innerText =
      pendingList.length;
    document.getElementById('labelTotalPending').innerText =
      pendingList.length + ' Pengajuan';

    var tbody = document.getElementById('tabelApprovalList');
    tbody.innerHTML = '';

    if (pendingList.length === 0) {
      var emptyRow = document.createElement('tr');
      var emptyCell = document.createElement('td');

      emptyCell.colSpan = 5;
      emptyCell.className = 'p-4 text-center text-slate-400';
      emptyCell.textContent =
        'Tidak ada pengajuan Dinas Luar yang menunggu.';

      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    pendingList.forEach(function (item) {
      var tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50/50';

      var tdTanggal = document.createElement('td');
      tdTanggal.className = 'p-3';
      tdTanggal.textContent = item.tanggal || '-';

      var jam = document.createElement('span');
      jam.className = 'text-[10px] text-slate-400';
      jam.textContent = item.jamMasuk || '';

      tdTanggal.appendChild(document.createElement('br'));
      tdTanggal.appendChild(jam);

      var tdPegawai = document.createElement('td');
      tdPegawai.className = 'p-3 font-bold text-slate-800';
      tdPegawai.textContent = item.nama || '-';

      var nip = document.createElement('span');
      nip.className = 'text-[10px] font-normal text-slate-500';
      nip.textContent = item.nip || '';

      tdPegawai.appendChild(document.createElement('br'));
      tdPegawai.appendChild(nip);

      var tdLokasi = document.createElement('td');
      tdLokasi.className = 'p-3';
      tdLokasi.textContent = item.keteranganLokasi || '-';

      var tdFoto = document.createElement('td');
      tdFoto.className = 'p-3';

      if (item.urlFoto) {
        var link = document.createElement('a');
        link.href = item.urlFoto;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'text-blue-600 font-semibold underline';
        link.textContent = 'Lihat Foto';
        tdFoto.appendChild(link);
      } else {
        tdFoto.textContent = '-';
      }

      var tdAksi = document.createElement('td');
      tdAksi.className = 'p-3 text-center space-x-1';

      var approveButton = document.createElement('button');
      approveButton.type = 'button';
      approveButton.className =
        'bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm';
      approveButton.textContent = 'Setujui';
      approveButton.addEventListener('click', function () {
        prosesApproval(item.rowId, 'Disetujui');
      });

      var rejectButton = document.createElement('button');
      rejectButton.type = 'button';
      rejectButton.className =
        'bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold border border-red-200';
      rejectButton.textContent = 'Tolak';
      rejectButton.addEventListener('click', function () {
        prosesApproval(item.rowId, 'Ditolak');
      });

      tdAksi.appendChild(approveButton);
      tdAksi.appendChild(rejectButton);

      [tdTanggal, tdPegawai, tdLokasi, tdFoto, tdAksi].forEach(
        function (td) {
          tr.appendChild(td);
        }
      );

      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Gagal memuat persetujuan Atasan:', error);

    document.getElementById('tabelApprovalList').innerHTML =
      '<tr><td colspan="5" class="p-4 text-center text-rose-500">' +
      'Gagal memuat pengajuan.</td></tr>';
  }
}

async function prosesApproval(rowId, statusKeputusan) {
  if (!confirm(
    'Apakah Anda yakin ingin mengubah status presensi ini menjadi ' +
    statusKeputusan + '?'
  )) {
    return;
  }

  try {
    const res = await callGAS('updateStatusApproval', {
      rowId: rowId,
      status: statusKeputusan
    });

    if (res && res.success) {
      alert(res.message || 'Status berhasil diperbarui.');
      await loadDataApprovalAtasan();
      await fetchAtasanData();
    } else {
      alert(
        'Gagal memperbarui status: ' +
        ((res && res.message) || 'Kesalahan sistem')
      );
    }
  } catch (error) {
    console.error('Gagal memperbarui persetujuan:', error);
    alert('Terjadi kesalahan saat memperbarui persetujuan.');
  }
}

function logoutAtasan() {
  if (
    currentAtasanUser &&
    currentAtasanUser.token &&
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

function populatePegawaiDropdown() {
  var selectEl = document.getElementById('filterNamaPegawai');
  selectEl.innerHTML = '';

  var allOption = document.createElement('option');
  allOption.value = 'ALL';
  allOption.textContent = '-- Semua Pegawai --';
  selectEl.appendChild(allOption);

  masterPegawaiList.forEach(function (peg) {
    var option = document.createElement('option');
    option.value = String(peg.nip == null ? '' : peg.nip);
    option.textContent =
      (peg.nama || '-') + ' (' + (peg.nip || '-') + ')';
    selectEl.appendChild(option);
  });
}

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

  var list = document.getElementById('listPresensiHariIni');
  list.innerHTML = '';

  if (masterPegawaiList.length === 0) {
    list.textContent = 'Belum ada data pegawai.';
    list.className = 'text-xs text-center text-slate-400 py-3';
    return;
  }

  list.className = 'space-y-2.5';

  masterPegawaiList.forEach(function (peg) {
    var log = todayLogsMap[String(peg.nip)];
    var badgeText = 'Belum Presensi';
    var badgeClass =
      'bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full';
    var jamInfo = '--:--:--';

    if (log) {
      jamInfo = 'Masuk: ' + (log.jamMasuk || '--:--:--');

      if (log.statusKode === 'H' || log.statusKode === 'H(PC)') {
        badgeText = 'Hadir';
        badgeClass =
          'bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full';
      } else if (log.statusKode === 'H(T)') {
        badgeText = 'Terlambat';
        badgeClass =
          'bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full';
      }
    }

    var item = document.createElement('div');
    item.className =
      'flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100';

    var left = document.createElement('div');
    var nama = document.createElement('p');
    nama.className = 'font-bold text-slate-800 text-xs';
    nama.textContent = peg.nama || '-';

    var detail = document.createElement('p');
    detail.className = 'text-[10px] text-slate-400';
    detail.textContent =
      'NIP: ' + (peg.nip || '-') + ' | ' + jamInfo;

    left.appendChild(nama);
    left.appendChild(detail);

    var badge = document.createElement('span');
    badge.className = badgeClass;
    badge.textContent = badgeText;

    item.appendChild(left);
    item.appendChild(badge);
    list.appendChild(item);
  });
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

  btnBulan.className =
    'flex-1 py-1.5 rounded-lg text-slate-600 transition';
  btnMingguIni.className =
    'flex-1 py-1.5 rounded-lg text-slate-600 transition';
  btnMingguLalu.className =
    'flex-1 py-1.5 rounded-lg text-slate-600 transition';
  btnIcon.className =
    'w-8 h-8 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition shrink-0';

  if (type === '1bulan') {
    btnBulan.className =
      'flex-1 py-1.5 rounded-lg bg-white text-blue-700 font-bold shadow-sm transition';
  }

  if (type === '1minggu_ini') {
    btnMingguIni.className =
      'flex-1 py-1.5 rounded-lg bg-white text-blue-700 font-bold shadow-sm transition';
  }

  if (type === '1minggu_lalu') {
    btnMingguLalu.className =
      'flex-1 py-1.5 rounded-lg bg-white text-blue-700 font-bold shadow-sm transition';
  }

  renderFilteredRekapSeluruhPegawai();
}

function applyCustomMonthYearFilter() {
  currentFilterType = 'custom';

  ['btnFilterBulan', 'btnFilterMingguIni', 'btnFilterMingguLalu']
    .forEach(function (id) {
      document.getElementById(id).className =
        'flex-1 py-1.5 rounded-lg text-slate-600 transition';
    });

  document.getElementById('btnFilterIcon').className =
    'w-8 h-8 rounded-lg bg-blue-700 text-white font-bold shadow-sm flex items-center justify-center transition shrink-0';

  closeModalFilterBulanTahun();
  renderFilteredRekapSeluruhPegawai();
}

function parseLocalDate(value) {
  if (!value) return null;

  var parts = String(value).slice(0, 10).split('-');
  if (parts.length !== 3) return null;

  var date = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

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

  var startDate = null;
  var endDate = null;

  if (
    currentFilterType === '1minggu_ini' ||
    currentFilterType === '1minggu_lalu'
  ) {
    var mondayOffset = (now.getDay() + 6) % 7;

    startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - mondayOffset,
      0, 0, 0, 0
    );

    if (currentFilterType === '1minggu_lalu') {
      startDate.setDate(startDate.getDate() - 7);
    }

    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  }

  var filtered = rawAllLogsData.filter(function (row) {
    var nip = String(row.nip == null ? '' : row.nip).trim();

    if (
      selectedNipFilter !== 'ALL' &&
      nip !== selectedNipFilter.trim()
    ) {
      return false;
    }

    var rowDate = parseLocalDate(row.tanggal);
    if (!rowDate) return false;

    if (currentFilterType === '1bulan') {
      return rowDate.getMonth() === now.getMonth() &&
        rowDate.getFullYear() === now.getFullYear();
    }

    if (
      currentFilterType === '1minggu_ini' ||
      currentFilterType === '1minggu_lalu'
    ) {
      return rowDate >= startDate && rowDate <= endDate;
    }

    if (currentFilterType === 'custom') {
      return rowDate.getMonth() === selectedBulan &&
        rowDate.getFullYear() === selectedTahun;
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
    var badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';

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
      'bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5';

    var top = document.createElement('div');
    top.className =
      'flex justify-between items-start border-b border-slate-100 pb-2';

    var titleWrap = document.createElement('div');
    var name = document.createElement('h4');
    name.className = 'font-bold text-slate-800 text-xs';
    name.textContent = row.nama || '-';

    var meta = document.createElement('p');
    meta.className = 'text-[10px] text-slate-400';
    meta.textContent =
      'NIP: ' + (row.nip || '-') + ' | ' +
      (row.tanggalPretty || row.tanggal || '-');

    titleWrap.appendChild(name);
    titleWrap.appendChild(meta);

    var status = document.createElement('span');
    status.className =
      badgeColor + ' border text-[10px] font-extrabold px-2.5 py-0.5 rounded-full';
    status.textContent = row.statusKode || '-';

    top.appendChild(titleWrap);
    top.appendChild(status);

    var times = document.createElement('div');
    times.className = 'grid grid-cols-2 gap-2 text-xs py-0.5';

    var masuk = document.createElement('div');
    var masukLabel = document.createElement('span');
    masukLabel.className = 'text-slate-400 block text-[10px]';
    masukLabel.textContent = 'Jam Masuk';

    var masukValue = document.createElement('span');
    masukValue.className = textClass;
    masukValue.textContent = row.jamMasuk || '-';

    masuk.appendChild(masukLabel);
    masuk.appendChild(masukValue);

    var pulang = document.createElement('div');
    pulang.className = 'text-right';

    var pulangLabel = document.createElement('span');
    pulangLabel.className = 'text-slate-400 block text-[10px]';
    pulangLabel.textContent = 'Jam Pulang';

    var pulangValue = document.createElement('span');
    pulangValue.className = textClass;
    pulangValue.textContent = row.jamPulang || '-';

    pulang.appendChild(pulangLabel);
    pulang.appendChild(pulangValue);

    times.appendChild(masuk);
    times.appendChild(pulang);

    var bottom = document.createElement('div');
    bottom.className =
      'flex justify-between items-center text-[10px] text-slate-500 pt-1.5 border-t border-slate-100';

    var location = document.createElement('span');
    var icon = document.createElement('i');
    icon.className = 'fa-solid fa-location-dot text-red-500 mr-1';

    location.appendChild(icon);
    location.appendChild(
      document.createTextNode(
        (row.keterangan || '-') + ' (' + (row.jarak || '-') + ')'
      )
    );

    bottom.appendChild(location);

    card.appendChild(top);
    card.appendChild(times);
    card.appendChild(bottom);
    container.appendChild(card);
  });
}

function switchTabAtasan(tab) {
  ['beranda', 'rekap', 'akun'].forEach(function (t) {
    var el = document.getElementById('tab-' + t);
    if (el) el.classList.add('hidden');

    var nav = document.getElementById('nav-' + t);
    if (nav) {
      nav.className =
        'flex flex-col items-center justify-center text-slate-400';
    }
  });

  var target = document.getElementById('tab-' + tab);
  if (target) target.classList.remove('hidden');

  var activeNav = document.getElementById('nav-' + tab);
  if (activeNav) {
    activeNav.className =
      'flex flex-col items-center justify-center text-blue-700';
  }
}
