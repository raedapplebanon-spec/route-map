let map;
let routeMarkers = [];
let availableMarkers = [];
let directionsService;
let directionsRenderer;
let mapReady = false;
let pendingData = null;

const MY_MAP_ID = "48c2bb983bd19c1c44d95cb7";

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

function setRouteData(routeArray, availableArray) {
  if (!mapReady) {
    pendingData = { route: routeArray, available: availableArray };
    return;
  }

  // CLEAR MARKERS
  routeMarkers.forEach(m => m.map = null);
  availableMarkers.forEach(m => m.map = null);
  routeMarkers = [];
  availableMarkers = [];
  directionsRenderer.setDirections({ routes: [] });

  const bounds = new google.maps.LatLngBounds();
  const infoWindow = new google.maps.InfoWindow();

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

  // DRAW ROUTE MARKERS
  routeArray.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);

    let color = "#1a73e8";
    if (s.isStart) color = "#00c853";
    if (s.isFinal) color = "#d50000";

    const html = `
      <div style="color:black; padding:5px; text-align:right; direction:rtl;">
        <strong>${s.label || "محطة"}</strong>
      </div>
    `;

    routeMarkers.push(addMarker(pos, s.label, html, color));
  });

  // DRAW AVAILABLE MARKERS
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

  if (routeArray.length >= 2) calculateRoadRoute(routeArray);
  if (routeArray.length + availableArray.length > 0) map.fitBounds(bounds);
}

function calculateRoadRoute(stops) {
  // 1️⃣ DEFINE FIXED START + END
  const start = stops.find(s => s.isStart === true);
  const end = stops.find(s => s.isFinal === true);

  if (!start || !end) return;

  // 2️⃣ WAYPOINTS (students only)
  const waypoints = stops
    .filter(s => !s.isStart && !s.isFinal)
    .map(s => ({
      location: { lat: s.lat, lng: s.lng },
      stopover: true,
    }));

  // 3️⃣ ASK GOOGLE FOR OPTIMIZED ROUTE
  directionsService.route(
    {
      origin: { lat: start.lat, lng: start.lng },
      destination: { lat: end.lat, lng: end.lng },
      waypoints: waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: true,  // ⭐ SUPER POWER
    },
    (result, status) => {
      if (status === "OK") {
        directionsRenderer.setDirections(result);
      }
    }
  );
}

window.initMap = initMap;
window.setRouteData = setRouteData;
