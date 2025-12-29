let map;
let routeMarkers = [];
let availableMarkers = [];
let directionsService;
let directionsRenderer;
let mapReady = false;
let pendingData = null;

const MY_MAP_ID = "48c2bb983bd19c1c44d95cb7";

/**
 * 1. INITIALIZE MAP
 */
async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

  const defaultCenter = { lat: 32.028031, lng: 35.704308 };

  map = new Map(document.getElementById("map"), {
    center: defaultCenter,
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
    polylineOptions: {
      strokeColor: "#1a73e8",
      strokeOpacity: 0.8,
      strokeWeight: 5,
    },
  });

  mapReady = true;
  if (pendingData) {
    setRouteData(pendingData.route, pendingData.available);
    pendingData = null;
  }
}

/**
 * 2. UPDATE HTML UI SUMMARY
 * This must be defined before it is called in the route callback.
 */
function updateRouteSummary(km, minutes) {
  const summaryBox = document.getElementById("route-summary");
  const summaryText = document.getElementById("summary-text");

  if (summaryBox && summaryText) {
    summaryBox.classList.remove("hidden"); // Show the box
    summaryText.innerHTML = `
      المسافة: <b>${km} كم</b><br>
      الوقت: <b>${minutes} دقيقة</b>
    `;
  }
}

/**
 * 3. RECEIVE DATA FROM FLUTTER
 */
function setRouteData(routeArray, availableArray) {
  if (!mapReady) {
    pendingData = { route: routeArray, available: availableArray };
    return;
  }

  // Clear existing markers and route
  routeMarkers.forEach(m => m.map = null);
  availableMarkers.forEach(m => m.map = null);
  routeMarkers = [];
  availableMarkers = [];
  directionsRenderer.setDirections({ routes: [] });
  
  // Hide summary until calculation completes
  const summaryBox = document.getElementById("route-summary");
  if (summaryBox) summaryBox.classList.add("hidden");

  const bounds = new google.maps.LatLngBounds();
  const infoWindow = new google.maps.InfoWindow();

  // Marker Helper
  const addMarker = (pos, title, html, color) => {
    const pin = new google.maps.marker.PinElement({
      background: color,
      borderColor: "#FFFFFF",
      glyphColor: "#FFFFFF",
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

    return marker;
  };

  // Process Assigned Route
  routeArray.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);

    let color = "#1a73e8"; // Blue (Student)
    if (s.isStart) color = "#00c853"; // Green (Start)
    if (s.isFinal) color = "#d50000"; // Red (Final)

    const html = `
      <div style="color:black; padding:5px; text-align:right; direction:rtl;">
        <strong>${s.label || "محطة"}</strong>
      </div>
    `;
    routeMarkers.push(addMarker(pos, s.label, html, color));
  });

  // Process Available Students (Orange)
  availableArray.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);

    const html = `
      <div style="color:black; padding:5px; text-align:right; direction:rtl;">
        👨‍🎓 <strong>${s.studentName}</strong><br>
        الصف: ${s.gradeName}<br>
        الشعبة: ${s.sectionName}
      </div>
    `;
    availableMarkers.push(addMarker(pos, s.studentName, html, "#ff9100"));
  });

  if (routeArray.length >= 2) {
    calculateRoadRoute(routeArray);
  }
  
  if (routeArray.length + availableArray.length > 0) {
    map.fitBounds(bounds);
  }
}

/**
 * 4. CALCULATE OPTIMIZED ROAD ROUTE
 */
function calculateRoadRoute(allStops) {
  // Only route points that are assigned or the start/end points
  const stops = allStops.filter(s =>
    s.isStart === true ||
    s.isFinal === true ||
    s.isAvailable === false
  );

  if (stops.length < 2) return;

  const start = stops.find(s => s.isStart) || stops[0];
  const end = stops.find(s => s.isFinal) || stops[stops.length - 1];

  const waypoints = stops
    .filter(s => !s.isStart && !s.isFinal)
    .map(s => ({
      location: { lat: s.lat, lng: s.lng },
      stopover: true,
    }));

  directionsService.route(
    {
      origin: { lat: start.lat, lng: start.lng },
      destination: { lat: end.lat, lng: end.lng },
      waypoints: waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: true, // Google decides most efficient order
    },
    (result, status) => {
      if (status === "OK") {
        directionsRenderer.setDirections(result);

        const route = result.routes[0];
        const legs = route.legs;

        let totalDistance = 0;
        let totalDuration = 0;

        legs.forEach(leg => {
          totalDistance += leg.distance.value; // Meters
          totalDuration += leg.duration.value; // Seconds
        });

        const km = (totalDistance / 1000).toFixed(1);
        const minutes = Math.round(totalDuration / 60);

        // Update the box in the HTML
        updateRouteSummary(km, minutes);
      } else {
        console.error("Directions request failed: " + status);
      }
    }
  );
}

// Global exposure for callback/Flutter
window.initMap = initMap;
window.setRouteData = setRouteData;
