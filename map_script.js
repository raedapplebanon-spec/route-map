let map;
let routeMarkers = [];
let availableMarkers = [];
let directionsService;
let directionsRenderer;
let mapReady = false;
let pendingData = null;

const MY_MAP_ID = "48c2bb983bd19c1c44d95cb7";

/**
 * ⭐ Distance + Clustering Helpers
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function groupCloseLocations(stops, tolerance = 5) {
  const clusters = [];
  stops.forEach(stop => {
    let placed = false;
    for (const c of clusters) {
      const d = haversineDistance(c.lat, c.lng, parseFloat(stop.lat), parseFloat(stop.lng));
      if (d < tolerance) {
        c.items.push(stop);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({
        lat: parseFloat(stop.lat),
        lng: parseFloat(stop.lng),
        items: [stop],
        // Preserve flags for the router
        isStart: stop.isStart === true,
        isFinal: stop.isFinal === true
      });
    }
  });
  return clusters;
}

/**
 * 1. UI Update Function
 */
function updateRouteSummary(km, minutes) {
  const summaryBox = document.getElementById("route-summary");
  const summaryText = document.getElementById("summary-text");
  if (summaryBox && summaryText) {
    summaryBox.classList.remove("hidden");
    summaryText.innerHTML = `المسافة: <b>${km} كم</b><br>الوقت: <b>${minutes} دقيقة</b>`;
  }
}

/**
 * 2. Initialize Map
 */
async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
  await google.maps.importLibrary("marker");

  map = new Map(document.getElementById("map"), {
    center: { lat: 32.028031, lng: 35.704308 },
    zoom: 13,
    mapId: MY_MAP_ID,
    mapTypeControl: false,
    streetViewControl: false,
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true,
    preserveViewport: true,
    polylineOptions: { strokeColor: "#1a73e8", strokeOpacity: 0.8, strokeWeight: 5 },
  });

  mapReady = true;
  if (pendingData) {
    setRouteData(pendingData.route, pendingData.available);
    pendingData = null;
  }
}

/**
 * 3. Process Data
 */
function setRouteData(routeArray, availableArray) {
  if (!mapReady) {
    pendingData = { route: routeArray, available: availableArray };
    return;
  }

  routeMarkers.forEach(m => m.map = null);
  availableMarkers.forEach(m => m.map = null);
  routeMarkers = [];
  availableMarkers = [];
  directionsRenderer.setDirections({ routes: [] });

  const summaryBox = document.getElementById("route-summary");
  if (summaryBox) summaryBox.classList.add("hidden");

  const bounds = new google.maps.LatLngBounds();
  const infoWindow = new google.maps.InfoWindow();

  const addMarker = (pos, title, html, color) => {
    const pin = new google.maps.marker.PinElement({ background: color, borderColor: "#FFFFFF", glyphColor: "#FFFFFF" });
    const marker = new google.maps.marker.AdvancedMarkerElement({ map: map, position: pos, title: title, content: pin.element });
    marker.addListener("click", () => {
      infoWindow.setContent(html);
      infoWindow.open(map, marker);
    });
    return marker;
  };

  // Cluster the data
  const routeClusters = groupCloseLocations(routeArray);
  const availableClusters = groupCloseLocations(availableArray);

  // Draw Route Markers
  routeClusters.forEach(cluster => {
    const pos = { lat: cluster.lat, lng: cluster.lng };
    bounds.extend(pos);

    const isStart = cluster.items.some(x => x.isStart);
    const isFinal = cluster.items.some(x => x.isFinal);
    let color = isStart ? "#00c853" : (isFinal ? "#d50000" : "#1a73e8");

    let html = `<div style="color:black;text-align:right;direction:rtl;">`;
    if (cluster.items.length > 1) html += `<b style="color:#1a73e8;">تجمع (${cluster.items.length} طلاب):</b><br>`;
    cluster.items.forEach(x => { html += `• ${x.label}<br>`; });
    html += `</div>`;

    routeMarkers.push(addMarker(pos, "route", html, color));
  });

  // Draw Available Markers
  availableClusters.forEach(cluster => {
    const pos = { lat: cluster.lat, lng: cluster.lng };
    bounds.extend(pos);
    let html = `<div style="color:black;text-align:right;direction:rtl;">`;
    cluster.items.forEach(x => {
      html += `👨‍🎓 <strong>${x.studentName}</strong><br>الصف: ${x.gradeName}<br><br>`;
    });
    html += `</div>`;
    availableMarkers.push(addMarker(pos, "available", html, "#ff9100"));
  });

  // Calculate route using CLUSTERS (to save waypoints)
  if (routeClusters.length >= 2) {
    calculateRoadRoute(routeClusters);
  }

  if (!bounds.isEmpty()) map.fitBounds(bounds);
}

/**
 * 4. Road Route Logic (Clustered Version)
 */
function calculateRoadRoute(clusters) {
  // Identify start/end from clusters
  const startStop = clusters.find(c => c.items.some(x => x.isStart));
  const endStop = clusters.find(c => c.items.some(x => x.isFinal));

  if (!startStop || !endStop) return;

  const waypoints = clusters
    .filter(c => c !== startStop && c !== endStop)
    .map(c => ({
      location: { lat: c.lat, lng: c.lng },
      stopover: true,
    }));

  directionsService.route({
    origin: { lat: startStop.lat, lng: startStop.lng },
    destination: { lat: endStop.lat, lng: endStop.lng },
    waypoints: waypoints,
    travelMode: google.maps.TravelMode.DRIVING,
    optimizeWaypoints: true,
  }, (result, status) => {
    if (status === "OK") {
      directionsRenderer.setDirections(result);
      const route = result.routes[0];
      let dist = 0, dur = 0;
      route.legs.forEach(leg => { dist += leg.distance.value; dur += leg.duration.value; });
      updateRouteSummary((dist / 1000).toFixed(1), Math.round(dur / 60));
    }
  });
}

window.initMap = initMap;
window.setRouteData = setRouteData;
