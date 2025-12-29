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

// --- NEW FUNCTION: Update the HTML UI Directly ---
function updateRouteSummary(km, minutes) {
  const summaryBox = document.getElementById("route-summary");
  const summaryText = document.getElementById("summary-text");

  if (summaryBox && summaryText) {
    summaryBox.classList.remove("hidden"); // Make it visible
    summaryText.innerHTML = `
      المسافة: <b>${km} كم</b><br>
      الوقت: <b>${minutes} دقيقة</b>
    `;
  }
}

function setRouteData(routeArray, availableArray) {
  if (!mapReady) {
    pendingData = { route: routeArray, available: availableArray };
    return;
  }

  // CLEAR DATA
  routeMarkers.forEach(m => m.map = null);
  availableMarkers.forEach(m => m.map = null);
  routeMarkers = [];
  availableMarkers = [];
  directionsRenderer.setDirections({ routes: [] });
  
  // Hide summary until new route is calculated
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

function calculateRoadRoute(allStops) {
  const stops = allStops.filter(s =>
    s.isStart === true ||
    s.isFinal === true ||
    s.isAvailable === false
  );

  if (stops.length < 2) return;

  const start = stops.find(s => s.isStart);
  const end = stops.find(s => s.isFinal);
  if (!start || !end) return;

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
      optimizeWaypoints: true,
    },
    (result, status) => {
      if (status === "OK") {
        directionsRenderer.setDirections(result);

        const route = result.routes[0];
        const legs = route.legs;

        let totalDistance = 0;
        let totalDuration = 0;

        legs.forEach(leg => {
          totalDistance += leg.distance.value; 
          totalDuration += leg.duration.value; 
        });

        const km = (totalDistance / 1000).toFixed(1);
        const minutes = Math.round(totalDuration / 60);

        // CALL THE UI UPDATE
        updateRouteSummary(km, minutes);
      }
    }
  );
}

window.initMap = initMap;
window.setRouteData = setRouteData;
