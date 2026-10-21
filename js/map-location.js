// ==================== GPS, REVERSE GEOCODING & MAPS ====================

let lastFetchTime = 0;

function startGpsTracking() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      function(pos) {
        currentLat = pos.coords.latitude;
        currentLng = pos.coords.longitude;
        
        document.getElementById('berandaKoordinat').innerText = 'Lat: ' + currentLat.toFixed(6) + ' | Long: ' + currentLng.toFixed(6);
        document.getElementById('presensiTitikLokasi').innerText = 'Lat: ' + currentLat.toFixed(6) + ' | Long: ' + currentLng.toFixed(6);

        var now = Date.now();
        // Throttle Request Nominatim OpenStreetMap (30 detik sekali)
        if (now - lastFetchTime > 30000 || lastFetchTime === 0) {
          lastFetchTime = now;
          
          fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + currentLat + '&lon=' + currentLng)
            .then(function(res) { return res.json(); })
            .then(function(data) {
              if (data && data.display_name) {
                document.getElementById('berandaLokasi').innerText = data.display_name;
              }
            })
            .catch(function(e) { 
              console.log("Gagal memuat nama lokasi:", e); 
            });
        }

        checkRadius();
        updateMap();
      },
      function(err) {
        document.getElementById('berandaLokasi').innerText = 'Izin GPS Diperlukan!';
      },
      { enableHighAccuracy: true }
    );
  }
}

function checkRadius() {
  if (!appConfig || !currentLat || !currentLng) return;
  var R = 6371000;
  var dLat = (currentLat - appConfig.config.latKantor) * Math.PI / 180;
  var dLon = (currentLng - appConfig.config.longKantor) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(appConfig.config.latKantor * Math.PI / 180) * Math.cos(currentLat * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var dist = R * c;

  var badge = document.getElementById('radiusBadge');
  if (dist <= appConfig.config.radiusMeter) {
    badge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800";
    badge.innerText = "Kantor Diskuktransesdm";
  } else {
    badge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800";
    badge.innerText = "Di luar kantor (" + Math.round(dist) + "m)";
  }
}

function initMap() {
  if (!map && currentLat && currentLng) {
    map = L.map('map').setView([currentLat, currentLng], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

    userMarker = L.marker([currentLat, currentLng]).addTo(map).bindPopup("<b>Posisi Anda</b>").openPopup();

    if (appConfig) {
      kantorCircle = L.circle([appConfig.config.latKantor, appConfig.config.longKantor], {
        color: 'blue', fillColor: '#3b82f6', fillOpacity: 0.2, radius: appConfig.config.radiusMeter
      }).addTo(map);
    }
  }
}

function updateMap() {
  if (map && currentLat && currentLng) {
    map.setView([currentLat, currentLng], 17);
    if (userMarker) userMarker.setLatLng([currentLat, currentLng]);
  }
}