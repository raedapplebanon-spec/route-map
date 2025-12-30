let map;
let routeMarkers = []; 
let availableMarkers = [];
let directionsService;
let directionsRenderer;
let mapReady = false;
let pendingData = null;

const MY_MAP_ID = "48c2bb983bd19c1c44d95cb7";

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
        isStart: stop.isStart === true,
        isFinal: stop.isFinal === true,
        hideMarker: (stop.hideMarker === true || stop.hideMarker === 'true')
      });
    }
  });
  return clusters;
}

function updateRouteSummary(km, minutes) {
  const summaryBox = document.getElementById("route-summary");
  const summaryText = document.getElementById("summary-text");
  if (summaryBox && summaryText) {
    summaryBox.classList.remove("hidden");
    summaryText.innerHTML = `المسافة: <b>${km} كم</b><br>الوقت: <b>${minutes} دقيقة</b>`;
  }
}

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

function setRouteData(routeArray, availableArray) {
  if (!mapReady) {
    pendingData = { route: routeArray, available: availableArray };
    return;
  }

  routeMarkers.forEach(obj => obj.marker.map = null);
  availableMarkers.forEach(m => m.map = null);
  routeMarkers = [];
  availableMarkers = [];
  directionsRenderer.setDirections({ routes: [] });

  const summaryBox = document.getElementById("route-summary");
  if (summaryBox) summaryBox.classList.add("hidden");

  const bounds = new google.maps.LatLngBounds();
  const infoWindow = new google.maps.InfoWindow();

  const addMarker = (pos, title, html, color, text) => {
    // ⭐ UPDATED: Using glyphText instead of glyph
    const pin = new google.maps.marker.PinElement({
      background: color,
      borderColor: "#FFFFFF",
      glyphColor: "#FFFFFF",
      glyphText: text 
    });

    const marker = new google.maps.marker.AdvancedMarkerElement({
      map: map,
      position: pos,
      title: title,
      content: pin.element,
    });

    marker.addListener("click", () => {
      infoWindow.setContent(html);
      infoWindow.open(map, marker);
    });

    return { marker, pin };
  };

  const routeClusters = groupCloseLocations(routeArray);
  const availableClusters = groupCloseLocations(availableArray);

  routeClusters.forEach(cluster => {
    if (cluster.hideMarker === true) return;
    const pos = { lat: cluster.lat, lng: cluster.lng };
    bounds.extend(pos);

    let color = cluster.isStart ? "#00c853" : (cluster.isFinal ? "#d50000" : "#1a73e8");
    let initialText = cluster.isStart ? "S" : (cluster.isFinal ? "E" : "...");

    let html = `<div style="color:black;text-align:right;direction:rtl;min-width:150px;">`;
    html += `<b style="color:${color};">محطة توقف</b><hr style="margin:5px 0;">`;
    cluster.items.forEach(x => { 
      let name = x.studentName || x.label || "طالب";
      html += `<div style="margin-bottom:4px;">• <b>${name}</b></div>`; 
    });
    html += `</div>`;

    const markerObj = addMarker(pos, "route", html, color, initialText);
    routeMarkers.push({ ...markerObj, lat: cluster.lat, lng: cluster.lng });
  });

  availableClusters.forEach(cluster => {
    if (cluster.hideMarker === true) return;
    const pos = { lat: cluster.lat, lng: cluster.lng };
    bounds.extend(pos);
    let html = `<div style="color:black;text-align:right;direction:rtl;min-width:150px;">`;
    html += `<b style="color:#ff9100;">خارج الجولة (${cluster.items.length})</b><hr style="margin:5px 0;">`;
    cluster.items.forEach(x => {
      html += `<div style="margin-bottom:8px;">👨‍🎓 <b>${x.studentName}</b><br><small>${x.gradeName}</small></div>`;
    });
    html += `</div>`;
    const mObj = addMarker(pos, "available", html, "#ff9100", cluster.items.length.toString());
    availableMarkers.push(mObj.marker);
  });

  if (routeClusters.length >= 2) {
    calculateRoadRoute(routeClusters);
  }

  if (!bounds.isEmpty()) map.fitBounds(bounds);
}

function calculateRoadRoute(clusters) {
  const startStop = clusters.find(c => c.isStart);
  const endStop = clusters.find(c => c.isFinal);
  if (!startStop || !endStop) return;

  const waypointClusters = clusters.filter(c => !c.isStart && !c.isFinal);

  directionsService.route({
    origin: { lat: startStop.lat, lng: startStop.lng },
    destination: { lat: endStop.lat, lng: endStop.lng },
    waypoints: waypointClusters.map(c => ({ location: { lat: c.lat, lng: c.lng }, stopover: true })),
    travelMode: google.maps.TravelMode.DRIVING,
    optimizeWaypoints: true,
  }, (result, status) => {
    if (status === "OK") {
      directionsRenderer.setDirections(result);
      
      const optimizedOrder = result.routes[0].waypoint_order; 
      optimizedOrder.forEach((originalIndex, stepIndex) => {
        const clusterData = waypointClusters[originalIndex];
        const stopNum = (stepIndex + 1).toString();

        const markerObj = routeMarkers.find(m => 
          Math.abs(m.lat - clusterData.lat) < 0.0001 && 
          Math.abs(m.lng - clusterData.lng) < 0.0001
        );

        if (markerObj) {
          // ⭐ UPDATED: Using glyphText instead of glyph
          markerObj.pin.glyphText = stopNum;
        }
      });

      const route = result.routes[0];
      let dist = 0, dur = 0;
      route.legs.forEach(leg => { dist += leg.distance.value; dur += leg.duration.value; });
      updateRouteSummary((dist / 1000).toFixed(1), Math.round(dur / 60));
    }
  });
}

window.initMap = initMap;
window.setRouteData = setRouteData;
