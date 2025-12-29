let map;
let routeMarkers = [];
let availableMarkers = [];
let directionsService;
let directionsRenderer;
let mapReady = false;
let pendingData = null;

// The Map ID from your screenshot
const MY_MAP_ID = "48c2bb983bd19c1c44d95cb7"; 

async function initMap() {
  // Import the necessary libraries for modern markers
  const { Map, InfoWindow } = await google.maps.importLibrary("maps");
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

  // Clear existing markers properly for AdvancedMarkerElement
  routeMarkers.forEach(m => m.map = null);
  availableMarkers.forEach(m => m.map = null);
  routeMarkers = [];
  availableMarkers = [];
  directionsRenderer.setDirections({ routes: [] });

  const bounds = new google.maps.LatLngBounds();
  const infoWindow = new google.maps.InfoWindow();

  // Helper to create markers with popups
  const addMarker = (pos, title, contentHtml, color) => {
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
      infoWindow.setContent(contentHtml);
      infoWindow.open(map, marker);
    });

    return marker;
  };

  // Process Route Stops
  routeArray.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);

    let color = "#1a73e8"; // Blue
    if (s.isStart) color = "#00c853"; // Green
    else if (s.isFinal) color = "#d50000"; // Red

    const html = `<div style="color:black; padding:5px; text-align:right; direction:rtl;">
                    <strong>${s.label || "محطة"}</strong>
                  </div>`;

    routeMarkers.push(addMarker(pos, s.label, html, color));
  });

  // Process Available Students
  availableArray.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);

    const html = `<div style="color:black; padding:5px; text-align:right; direction:rtl;">
                    👨‍🎓 <strong>${s.studentName}</strong><br>
                    Grade: ${s.gradeName}<br>
                    Section: ${s.sectionName}
                  </div>`;

    availableMarkers.push(addMarker(pos, s.studentName, html, "#ff9100")); // Orange
  });

  if (routeArray.length >= 2) calculateRoadRoute(routeArray);
  if (routeArray.length + availableArray.length > 0) map.fitBounds(bounds);
}

function calculateRoadRoute(stops) {
  const origin = { lat: stops[0].lat, lng: stops[0].lng };
  const destination = { lat: stops[stops.length - 1].lat, lng: stops[stops.length - 1].lng };
  const waypoints = stops.slice(1, -1).map(s => ({
    location: { lat: s.lat, lng: s.lng },
    stopover: true
  }));

  directionsService.route({
    origin: origin,
    destination: destination,
    waypoints: waypoints,
    travelMode: google.maps.TravelMode.DRIVING,
    optimizeWaypoints: false,
  }, (result, status) => {
    if (status === "OK") directionsRenderer.setDirections(result);
  });
}

window.initMap = initMap;
window.setRouteData = setRouteData;
