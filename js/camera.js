// ==================== KAMERA & PRESENSI SELFIE ====================

function openModalKamera() {
  var titleText = 'Presensi Masuk';
  if (todayPresensiStatus.hasMasuk && !todayPresensiStatus.hasPulang) {
    titleText = 'Presensi Pulang';
  }
  document.getElementById('modalTitle').innerText = titleText;

  capturedBase64 = null;
  document.getElementById('capturedImg').classList.add('hidden');
  document.getElementById('webcamVideo').classList.remove('hidden');
  document.getElementById('kameraActionBtns').classList.remove('hidden');
  document.getElementById('confirmActionBtns').classList.add('hidden');

  document.getElementById('modalKamera').classList.remove('hidden');
  startWebcam();
}

function startWebcam() {
  var constraints = {
    video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
    audio: false
  };

  navigator.mediaDevices.getUserMedia(constraints)
    .then(function(stream) {
      mediaStream = stream;
      var videoEl = document.getElementById('webcamVideo');
      videoEl.srcObject = stream;
    })
    .catch(function(err) {
      console.error("Gagal mengaktifkan kamera:", err);
      alert("Gagal mengaktifkan kamera. Pastikan izin akses kamera telah diberikan di browser Anda.");
      closeModalKamera();
    });
}

function stopWebcam() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(function(track) { track.stop(); });
    mediaStream = null;
  }
}

function closeModalKamera() {
  stopWebcam();
  document.getElementById('modalKamera').classList.add('hidden');
}

function takeSnapshot() {
  var videoEl = document.getElementById('webcamVideo');
  var canvasEl = document.getElementById('webcamCanvas');
  var imgEl = document.getElementById('capturedImg');

  if (!videoEl.srcObject) return alert("Stream kamera belum siap!");

  var width = videoEl.videoWidth || 640;
  var height = videoEl.videoHeight || 640;

  canvasEl.width = width;
  canvasEl.height = height;

  var ctx = canvasEl.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, width, height);

  capturedBase64 = canvasEl.toDataURL('image/jpeg', 0.85);

  imgEl.src = capturedBase64;
  imgEl.classList.remove('hidden');
  videoEl.classList.add('hidden');

  document.getElementById('kameraActionBtns').classList.add('hidden');
  document.getElementById('confirmActionBtns').classList.remove('hidden');

  stopWebcam();
}

function retakePhoto() {
  capturedBase64 = null;
  document.getElementById('capturedImg').classList.add('hidden');
  document.getElementById('webcamVideo').classList.remove('hidden');
  document.getElementById('kameraActionBtns').classList.remove('hidden');
  document.getElementById('confirmActionBtns').classList.add('hidden');

  startWebcam();
}

async function confirmAndSend() {
  var ketPresensiVal = document.getElementById('inputKetPresensi') ? document.getElementById('inputKetPresensi').value : '';
  if (!currentLat || !currentLng) return alert("GPS belum terkunci!");
  if (!capturedBase64) return alert("Silakan ambil foto selfie terlebih dahulu!");

  var tipePresensi = 'MASUK';
  if (todayPresensiStatus.hasMasuk && !todayPresensiStatus.hasPulang) {
    tipePresensi = 'PULANG';
  } else if (todayPresensiStatus.hasMasuk && todayPresensiStatus.hasPulang) {
    return alert("Anda sudah melakukan presensi masuk dan pulang hari ini!");
  }

  var payload = {
    nip: currentUser.nip,
    nama: currentUser.nama,
    shift: currentUser.shift,
    lat: currentLat,
    lng: currentLng,
    image: capturedBase64,
    type: tipePresensi,
    ketPresensi: ketPresensiVal
  };

  var btn = document.getElementById('btnPresensiMasuk');
  btn.disabled = true;
  btn.innerText = 'Mengirim...';

  const res = await callGAS('submitPresensi', { payload: payload });

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-1"></i> Kirim Presensi';
  closeModalKamera();

  alert(res.message);
  if (res.success) {
    loadData();
    switchTab('beranda');
  }
}