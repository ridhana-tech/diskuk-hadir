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
  if (!currentLat || !currentLng) return;
  
  // Gunakan nilai default kantor jika appConfig belum siap
  var latKantorDefault = (appConfig && appConfig.config) ? appConfig.config.latKantor : -7.59828;
  var longKantorDefault = (appConfig && appConfig.config) ? appConfig.config.longKantor : 110.95183;
  var radiusMaks = (appConfig && appConfig.config) ? appConfig.config.radiusMeter : 100;

  var R = 6371000;
  var dLat = (currentLat - latKantorDefault) * Math.PI / 180;
  var dLon = (currentLng - longKantorDefault) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(latKantorDefault * Math.PI / 180) * Math.cos(currentLat * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var dist = R * c;

  var badge = document.getElementById('radiusBadge');
  if (!badge) return;

  if (dist <= radiusMaks) {
    badge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800";
    badge.innerText = "Kantor Diskuktransesdm";
  } else {
    badge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800";
    badge.innerText = "Di luar kantor (" + Math.round(dist) + "m)";
  }
}

function initMap() {
  var mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  if (map) {
    setTimeout(function() {
      map.invalidateSize();
      if (currentLat && currentLng) {
        map.setView([currentLat, currentLng], 17);
        if (userMarker) userMarker.setLatLng([currentLat, currentLng]);
      }
    }, 150);
    return;
  }

  if (currentLat && currentLng) {
    map = L.map('map').setView([currentLat, currentLng], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
      maxZoom: 19, 
      attribution: '© OpenStreetMap' 
    }).addTo(map);

    userMarker = L.marker([currentLat, currentLng]).addTo(map).bindPopup("<b>Posisi Anda</b>").openPopup();

    if (appConfig && appConfig.config) {
      kantorCircle = L.circle([appConfig.config.latKantor, appConfig.config.longKantor], {
        color: 'blue', fillColor: '#3b82f6', fillOpacity: 0.2, radius: appConfig.config.radiusMeter
      }).addTo(map);
    }
    
    setTimeout(function() {
      map.invalidateSize();
    }, 200);
  }
}

function updateMap() {
  if (map && currentLat && currentLng) {
    map.setView([currentLat, currentLng], 17);
    if (userMarker) userMarker.setLatLng([currentLat, currentLng]);
  }
}