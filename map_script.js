let map;
let routeMarkers = []; 
let availableMarkers = [];
let directionsService;
let directionsRenderer;
let mapReady = false;
let pendingData = null;
let isFirstLoad = true;
let infoWindow; // Global infoWindow to reuse

const MY_MAP_ID = "48c2bb983bd19c1c44d95cb7";

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function groupCloseLocations(stops, tolerance = 15) {
  const clusters = [];
  stops.forEach(stop => {
    let placed = false;
    for (const c of clusters) {
      const d = haversineDistance(c.lat, c.lng, parseFloat(stop.lat), parseFloat(stop.lng));
      if (d < tolerance) {
        c.items.push(stop);
        if (stop.isStart === true) c.isStart = true;
        if (stop.isFinal === true) c.isFinal = true;
        c.hideMarker = c.hideMarker && (stop.hideMarker === true || stop.hideMarker === 'true');
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
  // 1. Import libraries
  const { Map } = await google.maps.importLibrary("maps");
  // We access ControlPosition directly from the google.maps namespace to avoid 'undefined' error
  const ControlPosition = google.maps.ControlPosition; 
  
  const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
  const { SearchBox } = await google.maps.importLibrary("places");

  infoWindow = new google.maps.InfoWindow();

  // 2. Initialize Map
  map = new Map(document.getElementById("map"), {
    center: { lat: 32.028031, lng: 35.704308 },
    zoom: 13,
    mapId: MY_MAP_ID,
    mapTypeControl: true,      
    streetViewControl: true,
  });

  // 3. Search Logic
  const input = document.getElementById("pac-input");
  const searchBox = new SearchBox(input);
  
  // Position the search box on the map
  if (ControlPosition && ControlPosition.TOP_LEFT) {
      map.controls[ControlPosition.TOP_LEFT].push(input);
  }

  searchBox.addListener("places_changed", () => {
    const query = input.value.trim().toLowerCase();
    if (!query) return;

    // Search locally in our students first
    const allMarkers = [...routeMarkers, ...availableMarkers];
    const found = allMarkers.find(m => 
      m.names && m.names.some(name => name.toLowerCase().includes(query))
    );

    if (found) {
      map.setCenter(found.marker.position);
      map.setZoom(18);
      infoWindow.setContent(found.html);
      infoWindow.open(map, found.marker);
    } else {
      // Standard Google Places search
      const places = searchBox.getPlaces();
      if (!places || places.length === 0) return;
      const bounds = new google.maps.LatLngBounds();
      places.forEach(place => {
        if (!place.geometry || !place.geometry.location) return;
        if (place.geometry.viewport) bounds.union(place.geometry.viewport);
        else bounds.extend(place.geometry.location);
      });
      map.fitBounds(bounds);
    }
  });

  // 4. Directions Setup (This part was failing because of the error above)
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
  availableMarkers.forEach(obj => obj.marker.map = null);
  routeMarkers = [];
  availableMarkers = [];
  directionsRenderer.setDirections({ routes: [] });

  const bounds = new google.maps.LatLngBounds();

  const addMarker = (pos, title, html, color, text, studentNames) => {
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

    // Store names and html for the search feature
    return { marker, pin, names: studentNames, html: html, lat: pos.lat, lng: pos.lng };
  };

  const routeClusters = groupCloseLocations(routeArray);
  const availableClusters = groupCloseLocations(availableArray);

  routeClusters.forEach(cluster => {
    if (cluster.hideMarker === true) return;
    const pos = { lat: cluster.lat, lng: cluster.lng };
    bounds.extend(pos);

    let color = cluster.isStart ? "#00c853" : (cluster.isFinal ? "#d50000" : "#1a73e8");
    let initialText = cluster.isStart ? "S" : (cluster.isFinal ? "E" : "...");
    let namesArr = cluster.items.map(x => x.studentName || x.label || "طالب");

    let html = `<div style="color:black;text-align:right;direction:rtl;min-width:150px;">`;
    html += `<b style="color:${color};">${cluster.isStart ? "نقطة البداية" : (cluster.isFinal ? "نقطة النهاية" : "محطة توقف")}</b><hr style="margin:5px 0;">`;
    namesArr.forEach(name => { html += `<div style="margin-bottom:4px;">• <b>${name}</b></div>`; });
    html += `</div>`;

    const markerObj = addMarker(pos, "route", html, color, initialText, namesArr);
    routeMarkers.push(markerObj);
  });

  availableClusters.forEach(cluster => {
    if (cluster.hideMarker === true) return;
    const pos = { lat: cluster.lat, lng: cluster.lng };
    bounds.extend(pos);
    let namesArr = cluster.items.map(x => x.studentName);

    let html = `<div style="color:black;text-align:right;direction:rtl;min-width:150px;">`;
    html += `<b style="color:#ff9100;">خارج الجولة (${cluster.items.length})</b><hr style="margin:5px 0;">`;
    cluster.items.forEach(x => {
      html += `<div style="margin-bottom:8px;">👨‍🎓 <b>${x.studentName}</b><br><small>${x.gradeName}</small></div>`;
    });
    html += `</div>`;

    const mObj = addMarker(pos, "available", html, "#ff9100", cluster.items.length.toString(), namesArr);
    availableMarkers.push(mObj);
  });

  if (routeClusters.length >= 2) calculateRoadRoute(routeClusters);
  
  if (!bounds.isEmpty() && isFirstLoad) {
    map.fitBounds(bounds);
    isFirstLoad = false;
  }
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
        if (markerObj) markerObj.pin.glyphText = stopNum;
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

