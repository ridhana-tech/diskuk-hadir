// ==================== AUTH & SESSION MANAGEMENT ====================

function getOrCreateDeviceImei() {
  var deviceId = localStorage.getItem('device_unique_imei');
  if (!deviceId) {
    deviceId = 'DEV-' + Math.random().toString(36).substring(2, 9).toUpperCase() + '-' + Date.now();
    localStorage.setItem('device_unique_imei', deviceId);
  }
  return deviceId;
}

async function login() {
  var nip = document.getElementById('loginNip').value;
  var pass = document.getElementById('loginPassword').value;
  if (!nip || !pass) return alert('Isi NIPJLP dan Password!');

  var currentDeviceImei = getOrCreateDeviceImei();

  var btn = document.getElementById('btnLogin');
  btn.disabled = true;
  btn.innerText = 'Memproses...';

  const res = await callGAS('login', { 
    nip: nip, 
    password: pass, 
    deviceImei: currentDeviceImei 
  });
  
  btn.disabled = false;
  btn.innerText = 'Masuk Akun';

  if (res.success) {
    currentUser = res.user;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    if (currentUser.role === 'ATASAN') {
      window.location.href = 'atasan.html';
      return;
    } else if (currentUser.role === 'ADMIN') {
      window.location.href = 'admin.html';
      return;
    }

    initAppWithUser(currentUser);
  } else {
    alert(res.message);
  }
}

function logout() {
  localStorage.removeItem('currentUser');
  currentUser = null;
  todayPresensiStatus = { hasMasuk: false, hasPulang: false };
  document.getElementById('loginNip').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('pagePegawai').classList.add('hidden');
  document.getElementById('pageLogin').classList.remove('hidden');
  switchTab('beranda');
}