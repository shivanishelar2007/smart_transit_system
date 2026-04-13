// ============================================================
// PUNERIDE — BUS DATA & CORE UTILITIES
// 3 sample PMPML-inspired routes with realistic Pune stops
// Each stop has a named location with accurate coordinates
// ============================================================

const BUS_DATA = [
  {
    id: "BUS_101",
    number: "101",
    name: "Shivajinagar → Swargate",
    color: "#e74c3c",
    frequency_min: 15,
    avg_speed_kmh: 14, // realistic city speed with stops
    stops: [
      { id: "101_1", name: "Shivajinagar Bus Stand",   lat: 18.5308, lng: 73.8474 },
      { id: "101_2", name: "FC Road / Goodluck Chowk", lat: 18.5237, lng: 73.8421 },
      { id: "101_3", name: "Deccan Gymkhana",          lat: 18.5197, lng: 73.8417 },
      { id: "101_4", name: "Nal Stop",                 lat: 18.5139, lng: 73.8395 },
      { id: "101_5", name: "Dandekar Bridge",          lat: 18.5061, lng: 73.8411 },
      { id: "101_6", name: "Swargate Bus Terminal",    lat: 18.4968, lng: 73.8561 }
    ],
    // schedule times at first stop
    schedule: ["06:00","06:15","06:30","06:45","07:00","07:15","07:30","07:45",
               "08:00","08:20","08:40","09:00","09:20","09:40","10:00","10:30",
               "11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30",
               "15:00","15:30","16:00","16:20","16:40","17:00","17:20","17:40",
               "18:00","18:20","18:40","19:00","19:30","20:00","20:30","21:00",
               "21:30","22:00"]
  },
  {
    id: "BUS_155",
    number: "155",
    name: "Katraj → Hadapsar",
    color: "#8e44ad",
    frequency_min: 20,
    avg_speed_kmh: 13,
    stops: [
      { id: "155_1", name: "Katraj Bus Stand",         lat: 18.4530, lng: 73.8678 },
      { id: "155_2", name: "Bibwewadi Corner",         lat: 18.4670, lng: 73.8625 },
      { id: "155_3", name: "Swargate Bus Terminal",    lat: 18.4968, lng: 73.8561 },
      { id: "155_4", name: "Market Yard",              lat: 18.5010, lng: 73.8650 },
      { id: "155_5", name: "Pune Railway Station",     lat: 18.5284, lng: 73.8742 },
      { id: "155_6", name: "Ghorpadi",                 lat: 18.5150, lng: 73.8980 },
      { id: "155_7", name: "Hadapsar Gadital",         lat: 18.5018, lng: 73.9260 }
    ],
    schedule: ["06:00","06:20","06:40","07:00","07:20","07:40","08:00","08:25",
               "08:50","09:15","09:40","10:00","10:30","11:00","11:30","12:00",
               "12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00",
               "16:20","16:40","17:00","17:25","17:50","18:15","18:40","19:05",
               "19:30","20:00","20:30","21:00","21:30","22:00"]
  },
  {
    id: "BUS_50",
    number: "50",
    name: "Wakad → Kothrud Depot",
    color: "#27ae60",
    frequency_min: 25,
    avg_speed_kmh: 16,
    stops: [
      { id: "50_1", name: "Wakad Phata",               lat: 18.5979, lng: 73.7601 },
      { id: "50_2", name: "Baner Road (D-Mart)",       lat: 18.5749, lng: 73.7836 },
      { id: "50_3", name: "Aundh IT Park",             lat: 18.5597, lng: 73.8078 },
      { id: "50_4", name: "Parihar Chowk",             lat: 18.5436, lng: 73.8105 },
      { id: "50_5", name: "Karve Road",                lat: 18.5200, lng: 73.8200 },
      { id: "50_6", name: "Kothrud Depot",             lat: 18.5074, lng: 73.8147 }
    ],
    schedule: ["07:00","07:25","07:50","08:15","08:40","09:05","09:30","10:00",
               "10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00",
               "14:30","15:00","15:30","16:00","16:25","16:50","17:15","17:40",
               "18:05","18:30","18:55","19:20","19:45","20:10","20:40","21:10",
               "21:40","22:00"]
  }
];

// ============================================================
// TRAFFIC PATTERN — Pune weekday (hour → level 1/2/3)
// ============================================================
const TRAFFIC_PATTERN = {
   0:1, 1:1, 2:1, 3:1, 4:1, 5:1,
   6:2, 7:3, 8:3, 9:3,10:2,11:2,
  12:2,13:2,14:2,15:2,16:3,17:3,
  18:3,19:3,20:2,21:2,22:1,23:1
};
const TRAFFIC_LABELS = {1:"Low Traffic", 2:"Moderate Traffic", 3:"Heavy Traffic"};
const TRAFFIC_COLORS = {1:"#27ae60",     2:"#f39c12",          3:"#e74c3c"};
const TRAFFIC_DELAY  = {1: 0.85, 2: 1.0, 3: 1.40}; // multiplier on travel time

function getCurrentTraffic() {
  return TRAFFIC_PATTERN[new Date().getHours()] || 2;
}

// ============================================================
// HAVERSINE distance (km) between two lat/lng
// ============================================================
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2
          + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ============================================================
// STOP MATCHING
// Given user's boarding and alighting stops (by id),
// find their index on a bus, verify direction is valid
// ============================================================
function matchStopsOnBus(bus, boardStopId, alightStopId) {
  const boardIdx  = bus.stops.findIndex(s => s.id === boardStopId);
  const alightIdx = bus.stops.findIndex(s => s.id === alightStopId);
  if (boardIdx === -1 || alightIdx === -1) return null;
  if (boardIdx === alightIdx) return null;
  // Bus travels forward only (index increases)
  if (alightIdx < boardIdx) return null;
  return { boardIdx, alightIdx };
}

// ============================================================
// NEXT DEPARTURE at a given stop index (accounting for travel
// time from terminus to that stop)
// ============================================================
function getNextDeparture(bus, stopIdx) {
  const now = new Date();
  const currentMin = now.getHours()*60 + now.getMinutes();
  const traffic = getCurrentTraffic();

  // Time to travel from stop 0 to stopIdx
  let distToStop = 0;
  for (let i = 0; i < stopIdx; i++) {
    distToStop += haversine(bus.stops[i].lat, bus.stops[i].lng,
                            bus.stops[i+1].lat, bus.stops[i+1].lng);
  }
  // travel time in minutes to reach this stop from terminus
  const travelToStopMin = Math.round((distToStop / bus.avg_speed_kmh) * 60 * TRAFFIC_DELAY[traffic]);

  for (const timeStr of bus.schedule) {
    const [h, m] = timeStr.split(':').map(Number);
    const terminusMin = h*60 + m;
    const arrivalAtStopMin = terminusMin + travelToStopMin;
    if (arrivalAtStopMin > currentMin) {
      const waitMin = arrivalAtStopMin - currentMin;
      const arrH = Math.floor(arrivalAtStopMin/60) % 24;
      const arrM = arrivalAtStopMin % 60;
      return {
        waitMin,
        arrivalTimeStr: `${String(arrH).padStart(2,'0')}:${String(arrM).padStart(2,'0')}`
      };
    }
  }
  // after last bus — show next day first bus
  return { waitMin: null, arrivalTimeStr: "Next day " + bus.schedule[0] };
}

// ============================================================
// FULL JOURNEY PREDICTION for one bus
// boardStop and alightStop are stop objects from BUS_DATA
// ============================================================
function computeJourney(bus, boardStopId, alightStopId) {
  const match = matchStopsOnBus(bus, boardStopId, alightStopId);
  if (!match) return null;

  const { boardIdx, alightIdx } = match;
  const boardStop  = bus.stops[boardIdx];
  const alightStop = bus.stops[alightIdx];
  const traffic    = getCurrentTraffic();
  const delay      = TRAFFIC_DELAY[traffic];

  // Route distance between board and alight
  let routeDistKm = 0;
  for (let i = boardIdx; i < alightIdx; i++) {
    routeDistKm += haversine(bus.stops[i].lat, bus.stops[i].lng,
                             bus.stops[i+1].lat, bus.stops[i+1].lng);
  }
  routeDistKm = Math.round(routeDistKm * 10) / 10;

  const stopsBetween = alightIdx - boardIdx;

  // Ride time: distance/speed * traffic delay + 1.5min per stop (dwell)
  const rawRideMins = (routeDistKm / bus.avg_speed_kmh) * 60;
  const dwellMins   = stopsBetween * 1.5;
  const rideMin     = Math.round((rawRideMins + dwellMins) * delay);

  // Next bus at boarding stop
  const dep = getNextDeparture(bus, boardIdx);

  // Destination arrival time
  const now = new Date();
  const totalOnBusMins = (dep.waitMin || 0) + rideMin;
  const destArr = new Date(now.getTime() + totalOnBusMins * 60000);
  const destH   = destArr.getHours();
  const destM   = destArr.getMinutes();
  const destTimeStr = `${String(destH).padStart(2,'0')}:${String(destM).padStart(2,'0')}`;

  return {
    bus,
    boardStop,
    alightStop,
    boardIdx,
    alightIdx,
    stopsBetween,
    routeDistKm,
    rideMin,
    waitMin:         dep.waitMin,
    busArrivalTime:  dep.arrivalTimeStr,
    totalMin:        (dep.waitMin || 0) + rideMin,
    destTimeStr,
    trafficLevel:    traffic,
    noMoreBusToday:  dep.waitMin === null
  };
}
