let map;
let routeMarkers = [];
let availableMarkers = [];
let routePolyline = null;

function initMap() {
  const defaultCenter = { lat: 32.028031, lng: 35.704308 };
  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultCenter,
    zoom: 13,
  });
}

function setRouteData(routeJson, availableJson) {
  routeMarkers.forEach((m) => m.setMap(null));
  availableMarkers.forEach((m) => m.setMap(null));
  routeMarkers = [];
  availableMarkers = [];

  if (routePolyline) {
    routePolyline.setMap(null);
    routePolyline = null;
  }

  const routeStops = JSON.parse(routeJson || "[]");
  const availableStudents = JSON.parse(availableJson || "[]");

  const bounds = new google.maps.LatLngBounds();

  // Route markers
  const routePath = [];

  routeStops.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);
    routePath.push(pos);

    let iconUrl = "http://maps.google.com/mapfiles/ms/icons/blue-dot.png";

    if (s.isStart) {
      iconUrl = "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
    } else if (s.isFinal) {
      iconUrl = "http://maps.google.com/mapfiles/ms/icons/red-dot.png";
    }

    const marker = new google.maps.Marker({
      position: pos,
      map,
      title: s.label || "",
      icon: iconUrl,
    });

    const info = new google.maps.InfoWindow({
      content: `
        <div style="font-size:13px;direction:rtl;text-align:right">
          ${s.label || "نقطة"}
        </div>
      `,
    });

    marker.addListener("click", () => info.open(map, marker));
    routeMarkers.push(marker);
  });

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

  // Available students
  availableStudents.forEach((s) => {
    const pos = { lat: s.lat, lng: s.lng };
    bounds.extend(pos);

    const title = `${s.studentName || "طالب"} - ${s.gradeName || ""}/${s.sectionName || ""}`;

    const marker = new google.maps.Marker({
      position: pos,
      map,
      title,
      icon: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png",
    });

    const info = new google.maps.InfoWindow({
      content: `
        <div style="font-size:13px;direction:rtl;text-align:right">
          👨‍🎓 ${s.studentName || ""}
          <br>
          📚 ${s.gradeName || ""} - ${s.sectionName || ""}
        </div>
      `,
    });

    marker.addListener("click", () => info.open(map, marker));
    availableMarkers.push(marker);
  });

  if (routeStops.length > 0 || availableStudents.length > 0) {
    map.fitBounds(bounds);
  } else {
    map.setCenter({ lat: 32.028031, lng: 35.704308 });
    map.setZoom(13);
  }
}

window.initMap = initMap;
window.setRouteData = setRouteData;
