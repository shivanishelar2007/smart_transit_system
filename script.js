// ============================================================
// PUNERIDE DASHBOARD — script.js
// ============================================================

let map;
let boardStopId  = null;   // selected boarding stop id  e.g. "101_1"
let alightStopId = null;   // selected alighting stop id e.g. "101_4"
let selectedBusId = null;

// Map layers
let routePolyline  = null;
let routeDash      = null;
const stopMarkers  = [];
let boardMarker    = null;
let alightMarker   = null;

// All unique stops across all buses, deduplicated by name
const ALL_STOPS = (function() {
  const seen = new Set();
  const list = [];
  BUS_DATA.forEach(bus => {
    bus.stops.forEach(stop => {
      if (!seen.has(stop.name)) {
        seen.add(stop.name);
        list.push({ id: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng, busId: bus.id });
      }
    });
  });
  return list.sort((a,b) => a.name.localeCompare(b.name));
})();

// ============================================================
// INIT
// ============================================================
window.addEventListener('load', () => {
  initMap();
  renderTrafficBadge();
  renderStopList('board', ALL_STOPS);
});

// ============================================================
// MAP
// ============================================================
function initMap() {
  map = L.map('map', { zoomControl: true }).setView([18.5200, 73.8553], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  // Draw all stops on the map as faint markers so user can see the network
  ALL_STOPS.forEach(stop => {
    L.circleMarker([stop.lat, stop.lng], {
      radius: 5,
      color: '#94a3b8',
      fillColor: '#fff',
      fillOpacity: 1,
      weight: 1.5
    }).addTo(map).bindTooltip(stop.name, { direction: 'top', opacity: 0.9 });
  });
}

function renderTrafficBadge() {
  const t = getCurrentTraffic();
  const badge = document.getElementById('traffic-badge');
  const label = document.getElementById('traffic-label');
  badge.style.background = TRAFFIC_COLORS[t];
  label.textContent = TRAFFIC_LABELS[t];
}

// ============================================================
// STOP LIST RENDERING
// ============================================================
function renderStopList(which, stops) {
  const el = document.getElementById(which + '-stop-list');
  el.innerHTML = '';
  if (stops.length === 0) {
    el.innerHTML = '<div class="no-stops">No stops found. Try a different search.</div>';
    return;
  }
  stops.forEach(stop => {
    const div = document.createElement('div');
    div.className = 'stop-item';
    div.innerHTML = `
      <div class="stop-icon">🚏</div>
      <div class="stop-text">
        <div class="stop-name">${stop.name}</div>
        <div class="stop-routes">${getRoutesForStop(stop.name)}</div>
      </div>
    `;
    div.onclick = () => selectStop(which, stop);
    el.appendChild(div);
  });
}

function getRoutesForStop(stopName) {
  const buses = BUS_DATA.filter(b => b.stops.some(s => s.name === stopName));
  if (buses.length === 0) return '';
  return 'Bus: ' + buses.map(b => b.number).join(', ');
}

function filterStops(which) {
  const query = document.getElementById(which + '-search').value.toLowerCase().trim();
  const filtered = ALL_STOPS.filter(s => s.name.toLowerCase().includes(query));
  renderStopList(which, filtered);
}

// ============================================================
// STOP SELECTION
// ============================================================
function selectStop(which, stop) {
  if (which === 'board') {
    boardStopId = stop.id;
    document.getElementById('board-selected-name').textContent = stop.name;
    document.getElementById('from-label').textContent = stop.name;

    // Highlight on map
    if (boardMarker) map.removeLayer(boardMarker);
    boardMarker = L.marker([stop.lat, stop.lng], { icon: makeIcon('#e74c3c', 'A') })
      .addTo(map)
      .bindPopup(`<b>Boarding Stop</b><br>${stop.name}`)
      .openPopup();
    map.setView([stop.lat, stop.lng], 14);

    // Move to step 2 — show only forward stops
    show('section-alight');
    hide('section-board');

    // For alight list: show all stops EXCEPT this one
    // (filtering to only those reachable will happen at bus-search step)
    const alightStops = ALL_STOPS.filter(s => s.name !== stop.name);
    renderStopList('alight', alightStops);

  } else {
    // alighting
    alightStopId = stop.id;
    document.getElementById('to-label').textContent = stop.name;

    if (alightMarker) map.removeLayer(alightMarker);
    alightMarker = L.marker([stop.lat, stop.lng], { icon: makeIcon('#27ae60', 'B') })
      .addTo(map)
      .bindPopup(`<b>Destination Stop</b><br>${stop.name}`)
      .openPopup();

    show('section-buses');
    hide('section-alight');
    findBuses();
  }
}

// ============================================================
// GPS — find nearest stop
// ============================================================
function useGPS() {
  if (!navigator.geolocation) {
    alert('Geolocation not supported by your browser.');
    return;
  }
  const btn = document.querySelector('.gps-btn');
  btn.textContent = '📍 Locating…';
  btn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    pos => {
      btn.textContent = '📍 Use GPS';
      btn.disabled = false;
      const { latitude: lat, longitude: lng } = pos.coords;

      // Find nearest stop
      let nearest = null, minD = Infinity;
      ALL_STOPS.forEach(s => {
        const d = haversine(lat, lng, s.lat, s.lng);
        if (d < minD) { minD = d; nearest = s; }
      });

      if (nearest && minD < 3) { // within 3 km
        selectStop('board', nearest);
      } else {
        alert('No bus stop found within 3 km of your location.\nPlease select from the list.');
      }
    },
    err => {
      btn.textContent = '📍 Use GPS';
      btn.disabled = false;
      alert('GPS unavailable. Please select your stop from the list below.\n\n(Allow location access in browser settings to use GPS.)');
    }
  );
}

// ============================================================
// FIND BUSES between selected stops
// ============================================================
function findBuses() {
  clearRouteFromMap();
  const resultsEl = document.getElementById('bus-results');
  resultsEl.innerHTML = '';

  // Find all (bus, boardStop, alightStop) combos that are valid
  const journeys = [];

  BUS_DATA.forEach(bus => {
    // Find the stop on this bus that matches boardStopId's NAME
    // (same stop can appear on multiple buses under different IDs)
    const boardStop  = bus.stops.find(s => s.id === boardStopId)
                    || bus.stops.find(s => s.name === getBoardStopName());
    const alightStop = bus.stops.find(s => s.id === alightStopId)
                    || bus.stops.find(s => s.name === getAlightStopName());

    if (!boardStop || !alightStop) return; // this bus doesn't serve both stops

    const boardIdx  = bus.stops.indexOf(boardStop);
    const alightIdx = bus.stops.indexOf(alightStop);
    if (alightIdx <= boardIdx) return; // wrong direction or same stop

    const journey = computeJourney(bus, boardStop.id, alightStop.id);
    if (journey) journeys.push(journey);
  });

  if (journeys.length === 0) {
    resultsEl.innerHTML = `
      <div class="no-bus-msg">
        <div class="no-bus-icon">🚫</div>
        <div class="no-bus-title">No direct bus found</div>
        <div class="no-bus-sub">No bus runs directly between these two stops.<br>
        Try choosing stops on the same route, or check the map to see which stops are connected.</div>
        <button class="btn-reset" onclick="resetAll()" style="margin-top:14px">Try different stops</button>
      </div>`;
    return;
  }

  // Sort by total time
  journeys.sort((a,b) => a.totalMin - b.totalMin);

  journeys.forEach((j, idx) => {
    const card = document.createElement('div');
    card.className = 'bus-card' + (idx === 0 ? ' best' : '');
    card.id = 'bus-card-' + j.bus.id;

    const tColor = TRAFFIC_COLORS[j.trafficLevel];
    const noMore = j.noMoreBusToday;

    card.innerHTML = `
      ${idx === 0 ? '<div class="best-badge">Fastest</div>' : ''}
      <div class="bus-card-top">
        <div class="bus-number" style="background:${j.bus.color}">${j.bus.number}</div>
        <div class="bus-info">
          <div class="bus-name">${j.bus.name}</div>
          <div class="bus-meta">${j.stopsBetween} stop${j.stopsBetween>1?'s':''} · ${j.routeDistKm} km</div>
        </div>
        <div class="bus-eta-mini">
          <div class="eta-mins">${j.totalMin}<span>min</span></div>
          <div class="eta-arrive">${noMore ? 'No more buses' : 'Arrive ' + j.destTimeStr}</div>
        </div>
      </div>
      <div class="bus-breakdown">
        <div class="bk-row"><span class="bk-icon">⏳</span><span>${noMore ? 'No more buses today' : 'Bus arrives at '+j.busArrivalTime + ' (wait '+j.waitMin+' min)'}</span></div>
        <div class="bk-row"><span class="bk-icon">🚌</span><span>Ride ${j.rideMin} min · ${j.stopsBetween} stops · ${j.routeDistKm} km</span></div>
        <div class="bk-row" style="color:${tColor}"><span class="bk-icon">🚦</span><span>${TRAFFIC_LABELS[j.trafficLevel]}</span></div>
      </div>
      <button class="btn-select-bus" onclick="selectBus('${j.bus.id}')">View on map →</button>
    `;
    resultsEl.appendChild(card);
  });

  // Auto-select the fastest
  selectBus(journeys[0].bus.id);
}

function getBoardStopName() {
  for (const bus of BUS_DATA) {
    const s = bus.stops.find(s => s.id === boardStopId);
    if (s) return s.name;
  }
  return null;
}
function getAlightStopName() {
  for (const bus of BUS_DATA) {
    const s = bus.stops.find(s => s.id === alightStopId);
    if (s) return s.name;
  }
  return null;
}

// ============================================================
// SELECT BUS — draw route, highlight board+alight stops
// ============================================================
function selectBus(busId) {
  selectedBusId = busId;
  const bus = BUS_DATA.find(b => b.id === busId);
  if (!bus) return;

  document.querySelectorAll('.bus-card').forEach(c => c.classList.remove('selected-card'));
  const card = document.getElementById('bus-card-' + busId);
  if (card) card.classList.add('selected-card');

  const boardStop  = bus.stops.find(s => s.id === boardStopId)
                  || bus.stops.find(s => s.name === getBoardStopName());
  const alightStop = bus.stops.find(s => s.id === alightStopId)
                  || bus.stops.find(s => s.name === getAlightStopName());
  if (!boardStop || !alightStop) return;

  drawRouteOnMap(bus, boardStop, alightStop);

  const journey = computeJourney(bus, boardStop.id, alightStop.id);
  if (journey) {
    show('section-eta');
    renderETA(journey);
  }
}

// ============================================================
// DRAW ROUTE ON MAP
// ============================================================
function drawRouteOnMap(bus, boardStop, alightStop) {
  clearRouteFromMap();

  const allCoords = bus.stops.map(s => [s.lat, s.lng]);

  // Full route — greyed out
  L.polyline(allCoords, {
    color: '#cbd5e1', weight: 4, opacity: 0.5, lineJoin: 'round'
  }).addTo(map);
  stopMarkers.push(null); // placeholder to clear later — use separate array

  const boardIdx  = bus.stops.indexOf(boardStop);
  const alightIdx = bus.stops.indexOf(alightStop);
  const activeCoords = bus.stops.slice(boardIdx, alightIdx+1).map(s => [s.lat, s.lng]);

  // Active segment — bright colored
  routePolyline = L.polyline(activeCoords, {
    color: bus.color, weight: 7, opacity: 0.9, lineJoin: 'round', lineCap: 'round'
  }).addTo(map);

  // White dashes on active segment
  routeDash = L.polyline(activeCoords, {
    color: '#fff', weight: 2, opacity: 0.5,
    dashArray: '8 14', lineJoin: 'round'
  }).addTo(map);

  // All stops on this bus — small grey circles
  bus.stops.forEach((stop, idx) => {
    let color = '#94a3b8', radius = 5, zIndex = 200;

    if (stop.id === boardStop.id) {
      color = '#e74c3c'; radius = 10; zIndex = 500;
    } else if (stop.id === alightStop.id) {
      color = '#27ae60'; radius = 10; zIndex = 500;
    } else if (idx > boardIdx && idx < alightIdx) {
      color = bus.color; radius = 6; zIndex = 300; // intermediate stops on active segment
    }

    const m = L.circleMarker([stop.lat, stop.lng], {
      radius, color: '#fff', fillColor: color,
      fillOpacity: 1, weight: 2
    }).addTo(map)
      .bindTooltip(
        `<b>${stop.name}</b>${stop.id === boardStop.id ? '<br>🟥 Your boarding stop' : stop.id === alightStop.id ? '<br>🟩 Your destination stop' : ''}`,
        { direction: 'top', opacity: 0.95 }
      );
    stopMarkers.push(m);
  });

  // Animated bus marker in the middle of active segment
  const midIdx = Math.floor((boardIdx + alightIdx) / 2);
  const busPos = bus.stops[midIdx];
  const busIcon = L.divIcon({
    className: '',
    html: `<div style="background:${bus.color};color:#fff;border-radius:8px;padding:4px 10px;font-size:13px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.25);white-space:nowrap;">🚌 ${bus.number}</div>`,
    iconSize: [64, 28],
    iconAnchor: [32, 14]
  });
  const bm = L.marker([busPos.lat, busPos.lng], { icon: busIcon, zIndexOffset: 1000 })
    .addTo(map)
    .bindPopup(`<b>Bus ${bus.number}</b><br>${bus.name}`);
  stopMarkers.push(bm);

  // Fit map to active segment + markers
  const bounds = L.latLngBounds(activeCoords);
  if (boardMarker) bounds.extend(boardMarker.getLatLng());
  if (alightMarker) bounds.extend(alightMarker.getLatLng());
  map.fitBounds(bounds, { padding: [60, 60] });
}

function clearRouteFromMap() {
  if (routePolyline) { map.removeLayer(routePolyline); routePolyline = null; }
  if (routeDash)     { map.removeLayer(routeDash);     routeDash = null; }
  stopMarkers.forEach(m => { if (m) map.removeLayer(m); });
  stopMarkers.length = 0;
  // Remove any leftover polylines (grey route)
  map.eachLayer(layer => {
    if (layer instanceof L.Polyline) map.removeLayer(layer);
  });
}

// ============================================================
// RENDER ETA PANEL
// ============================================================
function renderETA(j) {
  const el = document.getElementById('eta-result');
  const tColor = TRAFFIC_COLORS[j.trafficLevel];
  const noMore = j.noMoreBusToday;

  el.innerHTML = `
    <div class="eta-hero">
      <div>
        <div class="eta-big">${j.totalMin}</div>
        <div class="eta-unit">minutes on bus</div>
      </div>
      <div class="eta-arrive-box">
        <div class="eta-arrive-label">Arrive at stop</div>
        <div class="eta-arrive-time">${noMore ? 'No bus' : j.destTimeStr}</div>
      </div>
    </div>

    <div class="journey-timeline">
      <div class="tl-step">
        <div class="tl-dot" style="background:#f39c12"></div>
        <div class="tl-content">
          <div class="tl-title">Wait for Bus ${j.bus.number}</div>
          <div class="tl-sub">${noMore ? 'No more buses today on this route' : 'Bus arrives at your stop at ' + j.busArrivalTime + ' · wait ' + j.waitMin + ' min'}</div>
        </div>
        <div class="tl-time">${noMore ? '—' : j.waitMin + ' min'}</div>
      </div>
      <div class="tl-line"></div>
      <div class="tl-step">
        <div class="tl-dot" style="background:${j.bus.color}"></div>
        <div class="tl-content">
          <div class="tl-title">Board at ${j.boardStop.name}</div>
          <div class="tl-sub">Ride ${j.stopsBetween} stop${j.stopsBetween>1?'s':''} · ${j.routeDistKm} km</div>
        </div>
        <div class="tl-time">${j.rideMin} min</div>
      </div>
      <div class="tl-line"></div>
      <div class="tl-step">
        <div class="tl-dot" style="background:#27ae60"></div>
        <div class="tl-content">
          <div class="tl-title">Alight at ${j.alightStop.name}</div>
          <div class="tl-sub">${noMore ? '—' : 'Arrive ' + j.destTimeStr}</div>
        </div>
        <div class="tl-time">${noMore ? '—' : j.destTimeStr}</div>
      </div>
    </div>

    <div class="traffic-info-row" style="border-color:${tColor};color:${tColor}">
      <span>● ${TRAFFIC_LABELS[j.trafficLevel]}</span>
      <span style="color:#64748b;font-size:12px">ETA adjusted for current traffic</span>
    </div>

    <button class="btn-reset" onclick="resetAll()">← New Journey</button>
  `;
}

// ============================================================
// RESET HELPERS
// ============================================================
function resetToStep1() {
  boardStopId = null; alightStopId = null;
  if (boardMarker)  { map.removeLayer(boardMarker);  boardMarker  = null; }
  if (alightMarker) { map.removeLayer(alightMarker); alightMarker = null; }
  clearRouteFromMap();
  document.getElementById('board-search').value  = '';
  document.getElementById('board-selected-name').textContent = '—';
  renderStopList('board', ALL_STOPS);
  show('section-board');
  hide('section-alight');
  hide('section-buses');
  hide('section-eta');
  map.setView([18.5200, 73.8553], 12);
}

function resetToStep2() {
  alightStopId = null;
  if (alightMarker) { map.removeLayer(alightMarker); alightMarker = null; }
  clearRouteFromMap();
  hide('section-buses');
  hide('section-eta');
  document.getElementById('alight-search').value = '';
  const alightStops = ALL_STOPS.filter(s => s.name !== getBoardStopName());
  renderStopList('alight', alightStops);
  show('section-alight');
}

function resetAll() {
  resetToStep1();
}

// ============================================================
// HELPERS
// ============================================================
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

function makeIcon(color, label) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:#fff;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35)">${label}</div>`,
    iconSize: [34,34], iconAnchor: [17,17]
  });
}
