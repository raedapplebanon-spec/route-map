let map;
let routeMarkers = [];
let availableMarkers = [];

// New services for Road Routing
let directionsService;
let directionsRenderer;

let mapReady = false;
let pendingRouteData = null;

function initMap() {
  const defaultCenter = { lat: 32.028031, lng: 35.704308 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultCenter,
    zoom: 13,
    mapTypeControl: false,
    streetViewControl: false,
  });

  // Initialize Directions Service
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true, // We will use your custom markers instead of Google's default ones
    preserveViewport: true, // We will handle the zooming/bounds manually to include unassigned students
    polylineOptions: {
      strokeColor: "#1a73e8",
      strokeOpacity: 0.8,
      strokeWeight: 5,
    },
  });

  mapReady = true;

  // If we got data before map was ready
  if (pendingRouteData) {
    setRouteData(pendingRouteData.route, pendingRouteData.available);
    pendingRouteData = null;
  }
}

// routeArray & availableArray are ARRAYS
function setRouteData(routeArray, availableArray) {
  if (!mapReady) {
    pendingRouteData = { route: routeArray, available: availableArray };
    return;
  }

  // 1. Clear old markers
  routeMarkers.forEach((m) => m.setMap(null));
  availableMarkers.forEach((m) => m.setMap(null));
  routeMarkers = [];
  availableMarkers = [];

  // Clear the old road route
  directionsRenderer.setDirections({ routes: [] });

  const routeStops = Array.isArray(routeArray) ? routeArray : [];
  const availableStudents = Array.isArray(availableArray) ? availableArray : [];

  const bounds = new google.maps.LatLngBounds();

  // 2. Draw Your Custom Route Markers
  routeStops.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);

    // Determine Icon based on your logic
    // Note: Ensure these URLs are valid, otherwise markers might not appear
    let iconUrl = "http://maps.google.com/mapfiles/ms/icons/green-dot.png"; // Start default
    if (s.isStart) iconUrl = "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
    else if (s.isFinal) iconUrl = "http://maps.google.com/mapfiles/ms/icons/red-dot.png";
    else iconUrl = "http://maps.google.com/mapfiles/ms/icons/blue-dot.png";

    const marker = new google.maps.Marker({
      position: pos,
      map,
      title: s.label || "",
      icon: iconUrl,
    });

    const infoContent = `
        <div style="font-size:13px;direction:rtl;text-align:right;color:black">
           <b>${s.label || "نقطة"}</b>
        </div>`;

    const info = new google.maps.InfoWindow({ content: infoContent });
    marker.addListener("click", () => info.open(map, marker));
    routeMarkers.push(marker);
  });

  // 3. Draw Available (Unassigned) Markers
  availableStudents.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);

    const marker = new google.maps.Marker({
      position: pos,
      map,
      title: `${s.studentName || "طالب"}`,
      icon: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png",
    });

    const infoContent = `
        <div style="font-size:13px;direction:rtl;text-align:right;color:black">
           👨‍🎓 <b>${s.studentName || ""}</b><br>
           📚 ${s.gradeName || ""} - ${s.sectionName || ""}
        </div>`;

    const info = new google.maps.InfoWindow({ content: infoContent });
    marker.addListener("click", () => info.open(map, marker));
    availableMarkers.push(marker);
  });

  // 4. Calculate and Draw the Road Path
  if (routeStops.length >= 2) {
    calculateRoadRoute(routeStops);
  }

  // 5. Fit map to see everything
  if (routeStops.length + availableStudents.length > 0) {
    map.fitBounds(bounds);
  }
}

function calculateRoadRoute(stops) {
  if (!directionsService) return;

  const origin = { lat: stops[0].lat, lng: stops[0].lng };
  const destination = { lat: stops[stops.length - 1].lat, lng: stops[stops.length - 1].lng };

  // Note: Directions API (Legacy) is still the standard for JS DirectionsRenderer.
  // We keep optimizeWaypoints: false to ensure the school route order is strictly followed.
  const waypoints = stops.slice(1, -1).map((stop) => ({
    location: { lat: stop.lat, lng: stop.lng },
    stopover: true,
  }));

  directionsService.route(
    {
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: false,
    },
    (result, status) => {
      if (status === "OK") {
        directionsRenderer.setDirections(result);
      } else if (status === "REQUEST_DENIED") {
        console.error("❌ Google says: REQUEST_DENIED. Check if 'Directions API' is enabled in Cloud Console and billing is active.");
        alert("Map Error: Please enable Directions API in Google Cloud Console.");
      } else {
        console.error("Road route failed due to: " + status);
      }
    }
  );
}

// Expose functions globally
window.initMap = initMap;
window.setRouteData = setRouteData;

