let map;
let routeMarkers = [];
let availableMarkers = [];

let directionsService;
let directionsRenderer;

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

  // Directions API
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true, // keep your own markers
    polylineOptions: {
      strokeColor: "#1a73e8",
      strokeOpacity: 0.9,
      strokeWeight: 4,
    },
  });

  mapReady = true;

  // Apply stored data if iframe sent it before map was ready
  if (pendingRouteData) {
    setRouteData(pendingRouteData.route, pendingRouteData.available);
    pendingRouteData = null;
  }
}

// ---------------------------------------------------------
// Receive Route + Available arrays (NOT JSON strings)
// ---------------------------------------------------------
function setRouteData(routeArray, availableArray) {
  if (!mapReady) {
    pendingRouteData = { route: routeArray, available: availableArray };
    return;
  }

  // ----------------------------------------
  // Clear old markers
  // ----------------------------------------
  routeMarkers.forEach((m) => m.setMap(null));
  availableMarkers.forEach((m) => m.setMap(null));
  routeMarkers = [];
  availableMarkers = [];

  // Clear old route
  directionsRenderer.setDirections({ routes: [] });

  const routeStops = Array.isArray(routeArray) ? routeArray : [];
  const availableStudents = Array.isArray(availableArray) ? availableArray : [];

  const bounds = new google.maps.LatLngBounds();
  const routePath = [];

  // ----------------------------------------
  // Add route markers
  // ----------------------------------------
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

    const info = new google.maps.InfoWindow({
      content: `<div style="font-size:13px;direction:rtl;text-align:right">
        ${s.label || "نقطة"}
      </div>`
    });

    marker.addListener("click", () => info.open(map, marker));
    routeMarkers.push(marker);
  });

  // ----------------------------------------
  // Draw REAL DRIVING ROUTE using Directions API
  // ----------------------------------------
  if (routePath.length >= 2) {
    const origin = routePath[0];
    const destination = routePath[routePath.length - 1];

    // Create waypoints for all middle stops
    const waypoints = routePath.slice(1, -1).map((p) => ({
      location: p,
      stopover: true,
    }));

    directionsService.route(
      {
        origin,
        destination,
        waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(result);
        } else {
          console.error("❌ Directions failed:", status);
        }
      }
    );
  }

  // ----------------------------------------
  // Available markers
  // ----------------------------------------
  availableStudents.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);

    const marker = new google.maps.Marker({
      position: pos,
      map,
      title: `${s.studentName || "طالب"} - ${s.gradeName || ""}/${s.sectionName || ""}`,
      icon: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="font-size:13px;direction:rtl;text-align:right">
        👨‍🎓 ${s.studentName || ""}<br>
        📚 ${s.gradeName || ""} - ${s.sectionName || ""}
      </div>`
    });

    marker.addListener("click", () => info.open(map, marker));
    availableMarkers.push(marker);
  });

  // ----------------------------------------
  // Fit map to all markers
  // ----------------------------------------
  if (routeStops.length > 0 || availableStudents.length > 0) {
    map.fitBounds(bounds);
  } else {
    map.setCenter({ lat: 32.028031, lng: 35.704308 });
    map.setZoom(13);
  }
}

window.initMap = initMap;
window.setRouteData = setRouteData;
