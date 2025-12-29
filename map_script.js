let map;
let routeMarkers = [];
let availableMarkers = [];
let routePolyline = null;

let mapReady = false;
let pendingRouteData = null;

function initMap() {
  const defaultCenter = { lat: 32.028031, lng: 35.704308 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultCenter,
    zoom: 13,
  });

  mapReady = true;

  // If we got data before map was ready
  if (pendingRouteData) {
    setRouteData(pendingRouteData.route, pendingRouteData.available);
    pendingRouteData = null;
  }
}

// routeArray & availableArray are ARRAYS now
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

  if (routePolyline) {
    routePolyline.setMap(null);
    routePolyline = null;
  }

  const routeStops = Array.isArray(routeArray) ? routeArray : [];
  const availableStudents = Array.isArray(availableArray) ? availableArray : [];

  const bounds = new google.maps.LatLngBounds();
  const routePath = [];

  // Route markers
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
      content: <div style="font-size:13px;direction:rtl;text-align:right">
                  ${s.label || "نقطة"}
                </div>
    });

    marker.addListener("click", () => info.open(map, marker));
    routeMarkers.push(marker);
  });

  // Polyline
  if (routePath.length >= 2) {
    routePolyline = new google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: "#1a73e8",
      strokeOpacity: 0.9,
      strokeWeight: 3,
    });
    routePolyline.setMap(map);
  }

  // Available markers
  availableStudents.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);

    const marker = new google.maps.Marker({
      position: pos,
      map,
      title: ${s.studentName || "طالب"} - ${s.gradeName || ""}/${s.sectionName || ""},
      icon: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
    });

    const info = new google.maps.InfoWindow({
      content: <div style="font-size:13px;direction:rtl;text-align:right">
                  👨‍🎓 ${s.studentName || ""}
                  <br>
                  📚 ${s.gradeName || ""} - ${s.sectionName || ""}
                </div>
    });

    marker.addListener("click", () => info.open(map, marker));
    availableMarkers.push(marker);
  });

  // Fit map
  if (routeStops.length + availableStudents.length > 0) {
    map.fitBounds(bounds);
  } else {
    map.setCenter({ lat: 32.028031, lng: 35.704308 });
    map.setZoom(13);
  }
}

window.initMap = initMap;
window.setRouteData = setRouteData;
