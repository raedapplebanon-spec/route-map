let map;
let marker;
let geocoder;

async function initPickerMap() {
  // 1. Properly await the libraries
  await google.maps.importLibrary("maps");
  await google.maps.importLibrary("marker");
  await google.maps.importLibrary("places");
  await google.maps.importLibrary("geocoding");

  const Map = google.maps.Map;
  const AdvancedMarkerElement = google.maps.marker.AdvancedMarkerElement;
  const SearchBox = google.maps.places.SearchBox;
  const ControlPosition = google.maps.ControlPosition;
  geocoder = new google.maps.Geocoder();

  // 2. Initialize Map
  map = new Map(document.getElementById("map"), {
    center: { lat: 32.028, lng: 35.704 },
    zoom: 16,
    mapId: "48c2bb983bd19c1c44d95cb7",
    streetViewControl: false,
    mapTypeControl: true,
  });

  // 3. Create the Marker (Center-Locked Style)
  marker = new AdvancedMarkerElement({
    map: map,
    position: map.getCenter(),
    title: "الموقع المختار"
  });

  // --- Center-Locked Logic ---
  // Marker follows map center
  map.addListener("center_changed", () => {
    marker.position = map.getCenter();
  });

  // When map stops moving, send data to Flutter
  map.addListener("idle", () => {
    const pos = map.getCenter();
    reverseGeocode(pos);
    sendToFlutter(pos.lat(), pos.lng());
  });

  // 4. Setup Search Box
  const input = document.getElementById("pac-input");
  const searchBox = new SearchBox(input);
  if (ControlPosition && ControlPosition.TOP_LEFT) {
    map.controls[ControlPosition.TOP_LEFT].push(input);
  }

  searchBox.addListener("places_changed", () => {
    const places = searchBox.getPlaces();
    if (places.length === 0) return;
    const pos = places[0].geometry.location;
    map.setCenter(pos); // Map moves, and marker follows via center_changed
  });
}

// 5. EDIT MODE: Listen for initial position from Flutter
window.addEventListener("message", (event) => {
  if (event.data.action === "setInitialPos") {
    const pos = { 
        lat: parseFloat(event.data.lat), 
        lng: parseFloat(event.data.lng) 
    };
    if (map) {
      map.setCenter(pos);
      map.setZoom(18); // Zoom in closer for editing
    }
  }
});

function reverseGeocode(latLng) {
  geocoder.geocode({ location: latLng }, (results, status) => {
    if (status === "OK" && results[0]) {
      document.getElementById("pac-input").value = results[0].formatted_address;
    }
  });
}

function sendToFlutter(lat, lng) {
  const data = { action: "locationPicked", lat: lat, lng: lng };
  if (window.FlutterChan) {
    window.FlutterChan.postMessage(JSON.stringify(data));
  } else {
    window.parent.postMessage(data, "*");
  }
}

// Ensure the callback is globally available
window.initPickerMap = initPickerMap;
