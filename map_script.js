let map;
let routeMarkers = [];
let availableMarkers = [];

let routeService;      // NEW Routes API client
let routeRenderer;     // Custom polyline renderer

let mapReady = false;
let pendingRouteData = null;

// ---------------------------------------------------------
// Initialize Google Map
// ---------------------------------------------------------
function initMap() {
  const defaultCenter = { lat: 32.028031, lng: 35.704308 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultCenter,
    zoom: 13,
  });

  // NEW Google Maps Routes API client
  routeService = new google.maps.routes.RoutesService();

  mapReady = true;

  if (pendingRouteData) {
    setRouteData(pendingRouteData.route, pendingRouteData.available);
    pendingRouteData = null;
  }
}

// ---------------------------------------------------------
// Draw polyline manually from Routes API response
// ---------------------------------------------------------
function drawRoutePolyline(polyline) {
  if (!polyline || !polyline.encodedPolyline) return;

  const path = google.maps.geometry.encoding.decodePath(
    polyline.encodedPolyline
  );

  if (routeRenderer) {
    routeRenderer.setMap(null);
  }

  routeRenderer = new google.maps.Polyline({
    path,
    strokeColor: "#1a73e8",
    strokeOpacity: 0.9,
    strokeWeight: 4,
    map,
  });
}

// ---------------------------------------------------------
// Handle route data
// ---------------------------------------------------------
function setRouteData(routeArray, availableArray) {
  if (!mapReady) {
    pendingRouteData = { route: routeArray, available: availableArray };
    return;
  }

  // Clear old markers
  routeMarkers.forEach((m) => m.setMap(null));
  availableMarkers.forEach((m) => m.setMap(null));
  routeMarkers = [];
  availableMarkers = [];

  if (routeRenderer) {
    routeRenderer.setMap(null);
    routeRenderer = null;
  }

  const routeStops = Array.isArray(routeArray) ? routeArray : [];
  const availableStudents = Array.isArray(availableArray) ? availableArray : [];

  const bounds = new google.maps.LatLngBounds();
  const routePath = [];

  // Add route markers
  routeStops.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);
    routePath.push(pos);

    let iconUrl = "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";
    if (s.isStart) iconUrl = "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
    else if (s.isFinal) iconUrl = "https://maps.google.com/mapfiles/ms/icons/red-dot.png";

    const marker = new google.maps.Marker({
      position: pos,
      map,
      title: s.label || "",
      icon: iconUrl,
    });

    routeMarkers.push(marker);
  });

  // ----------------------------------------
  // NEW: Draw REAL DRIVING ROUTE (Routes API)
  // ----------------------------------------
  if (routePath.length >= 2) {
    const origin = routePath[0];
    const destination = routePath[routePath.length - 1];

    const waypoints = routePath.slice(1, -1).map((p) => ({
      location: { latLng: { latitude: p.lat, longitude: p.lng } }
    }));

    routeService.computeRoutes(
      {
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        intermediates: waypoints,
        travelMode: "DRIVE",
        polylineQuality: "HIGH_QUALITY",
        polylineEncoding: "ENCODED_POLYLINE",
      },
      (response) => {
        if (response.routes && response.routes.length > 0) {
          drawRoutePolyline(response.routes[0].polyline);
        } else {
          console.error("❌ No routes returned:", response);
        }
      }
    );
  }

  // Add available markers
  availableStudents.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);

    const marker = new google.maps.Marker({
      position: pos,
      map,
      title: `${s.studentName || "طالب"} - ${s.gradeName || ""}/${s.sectionName || ""}`,
      icon: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
    });

    availableMarkers.push(marker);
  });

  // Fit map
  map.fitBounds(bounds);
}

window.initMap = initMap;
window.setRouteData = setRouteData;
