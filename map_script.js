let map;
let routeMarkers = [];
let availableMarkers = [];
let directionsService;
let directionsRenderer;
let mapReady = false;
let pendingData = null;

const MY_MAP_ID = "48c2bb983bd19c1c44d95cb7";

/**
 * 1. UI Update Function
 */
function updateRouteSummary(km, minutes) {
  const summaryBox = document.getElementById("route-summary");
  const summaryText = document.getElementById("summary-text");

  if (summaryBox && summaryText) {
    summaryBox.classList.remove("hidden");
    summaryText.innerHTML = `
      المسافة: <b>${km} كم</b><br>
      الوقت: <b>${minutes} دقيقة</b>
    `;
  }
}

/**
 * 2. Initialize Map
 */
async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
  await google.maps.importLibrary("marker"); // Load marker library

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

  // 1. Draw Route Markers (Blue/Green/Red)
  routeArray.forEach((s) => {
    // 🛑 Skip drawing the marker if the filter says hide it
    if (s.hideMarker === true) return; 

    const pos = { lat: parseFloat(s.lat), lng: parseFloat(s.lng) };
    bounds.extend(pos);
    
    let color = s.isStart ? "#00c853" : (s.isFinal ? "#d50000" : "#1a73e8");
    const html = `<div style="color:black; padding:5px; text-align:right; direction:rtl;"><strong>${s.label || "محطة"}</strong></div>`;
    
    routeMarkers.push(addMarker(pos, s.label, html, color));
  });

  // 2. Draw Available Markers (Orange)
  availableArray.forEach((s) => {
    // 🛑 Skip drawing if hidden
    if (s.hideMarker === true) return;

    const pos = { lat: parseFloat(s.lat), lng: parseFloat(s.lng) };
    bounds.extend(pos);
    
    const html = `<div style="color:black; padding:5px; text-align:right; direction:rtl;">👨‍🎓 <strong>${s.studentName}</strong><br>الصف: ${s.gradeName}<br>الشعبة: ${s.sectionName}</div>`;
    
    availableMarkers.push(addMarker(pos, s.studentName, html, "#ff9100"));
  });

  // 3. Always calculate route based on the FULL array 
  // (the line stays even if markers are hidden)
  if (routeArray.length >= 2) calculateRoadRoute(routeArray);
  
  if (routeArray.length + availableArray.length > 0) map.fitBounds(bounds);
}

/**
 * 4. Road Route Logic
 */
function calculateRoadRoute(allStops) {
  // Use a loose check for 'false' in case it comes as a string
  const stops = allStops.filter(s =>
    s.isStart === true ||
    s.isFinal === true ||
    String(s.isAvailable) === 'false'
  );

  if (stops.length < 2) return;

  const startStop = stops.find(s => s.isStart === true);
  const endStop = stops.find(s => s.isFinal === true);
  
  if (!startStop || !endStop) return;

  // ENSURE NUMBERS: use parseFloat to prevent silent routing failures
  const origin = { lat: parseFloat(startStop.lat), lng: parseFloat(startStop.lng) };
  const destination = { lat: parseFloat(endStop.lat), lng: parseFloat(endStop.lng) };

  const waypoints = stops
    .filter(s => !s.isStart && !s.isFinal)
    .map(s => ({
      location: { lat: parseFloat(s.lat), lng: parseFloat(s.lng) },
      stopover: true,
    }));

  directionsService.route(
    {
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: true,
    },
    (result, status) => {
      if (status === "OK") {
        directionsRenderer.setDirections(result);

        const route = result.routes[0];
        let totalDistance = 0;
        let totalDuration = 0;

        route.legs.forEach(leg => {
          totalDistance += leg.distance.value; 
          totalDuration += leg.duration.value; 
        });

        const km = (totalDistance / 1000).toFixed(1);
        const minutes = Math.round(totalDuration / 60);

        updateRouteSummary(km, minutes);
      } else {
        console.error("Directions Error Status:", status);
      }
    }
  );
}

window.initMap = initMap;
window.setRouteData = setRouteData;

