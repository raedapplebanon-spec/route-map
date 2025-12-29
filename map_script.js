let map;
let routeMarkers = [];
let availableMarkers = [];
let routePolyline = null;

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

  mapReady = true;

  if (pendingRouteData) {
    setRouteData(pendingRouteData.route, pendingRouteData.available);
    pendingRouteData = null;
  }
}

// ---------------------------------------------------------
// Draw Polyline from encoded polyline
// ---------------------------------------------------------
function drawPolyline(encoded) {
  if (routePolyline) {
    routePolyline.setMap(null);
  }

  const path = google.maps.geometry.encoding.decodePath(encoded);

  routePolyline = new google.maps.Polyline({
    path,
    strokeColor: "#1a73e8",
    strokeOpacity: 0.9,
    strokeWeight: 4,
    map,
  });
}

// ---------------------------------------------------------
// Call Supabase Edge Function (server-side routing)
// ---------------------------------------------------------
async function requestDrivingRoute(origin, destination, waypoints = []) {
  const response = await fetch(
    "https://yrhhdstnolguxmesxnnv.supabase.co/functions/v1/get_route",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        origin: { latitude: origin.lat, longitude: origin.lng },
        destination: { latitude: destination.lat, longitude: destination.lng },
        waypoints: waypoints.map((p) => ({
          latitude: p.lat,
          longitude: p.lng,
        })),
      }),
    }
  );

  const data = await response.json();

  if (!data.routes || data.routes.length === 0) {
    console.error("❌ No route returned:", data);
    return;
  }

  const encoded = data.routes[0].polyline.encodedPolyline;
  drawPolyline(encoded);
}

// ---------------------------------------------------------
// Update map with new stops
// ---------------------------------------------------------
function setRouteData(routeArray, availableArray) {
  if (!mapReady) {
    pendingRouteData = { route: routeArray, available: availableArray };
    return;
  }

  // Clear markers
  routeMarkers.forEach((m) => m.setMap(null));
  availableMarkers.forEach((m) => m.setMap(null));
  routeMarkers = [];
  availableMarkers = [];

  if (routePolyline) {
    routePolyline.setMap(null);
    routePolyline = null;
  }

  const bounds = new google.maps.LatLngBounds();
  const routePath = [];

  // Route markers
  routeArray.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);
    routePath.push(pos);

    let icon = "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";
    if (s.isStart) icon = "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
    else if (s.isFinal) icon = "https://maps.google.com/mapfiles/ms/icons/red-dot.png";

    const marker = new google.maps.Marker({
      position: pos,
      map,
      icon,
      title: s.label || "",
    });

    routeMarkers.push(marker);
  });

  // Call routing if at least two points
  if (routePath.length >= 2) {
    const origin = routePath[0];
    const destination = routePath[routePath.length - 1];
    const waypoints = routePath.slice(1, -1);

    requestDrivingRoute(origin, destination, waypoints);
  }

  // Available markers
  availableArray.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);

    const marker = new google.maps.Marker({
      position: pos,
      map,
      icon: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
    });

    availableMarkers.push(marker);
  });

  map.fitBounds(bounds);
}

window.initMap = initMap;
window.setRouteData = setRouteData;
