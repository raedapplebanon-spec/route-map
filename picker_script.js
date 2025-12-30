let map;
let marker;
let infoWindow;
let geocoder;

async function initPickerMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  const { SearchBox } = await google.maps.importLibrary("places");
  const { Geocoder } = await google.maps.importLibrary("geocoding");

  const ControlPosition = google.maps.ControlPosition;
  geocoder = new Geocoder();

  // Initialize Map
  map = new Map(document.getElementById("map"), {
    center: { lat: 32.028, lng: 35.704 },
    zoom: 15,
    mapId: "48c2bb983bd19c1c44d95cb7",
    streetViewControl: false,
    mapTypeControl: true,
  });

  // Create the Picker Marker
  marker = new AdvancedMarkerElement({
    map: map,
    position: { lat: 32.028, lng: 35.704 },
    gmpDraggable: true,
    title: "اسحب لتحديد الموقع"
  });

  // Setup Search Box
  const input = document.getElementById("pac-input");
  const searchBox = new SearchBox(input);
  map.controls[ControlPosition.TOP_LEFT].push(input);

  // --- EVENTS ---

  // A. Search box selection
  searchBox.addListener("places_changed", () => {
    const places = searchBox.getPlaces();
    if (places.length === 0) return;
    const pos = places[0].geometry.location;
    map.setCenter(pos);
    marker.position = pos;
    sendToFlutter(pos.lat(), pos.lng());
  });

  // B. Dragging the pin
  marker.addListener("dragend", () => {
    const pos = marker.position;
    reverseGeocode(pos);
    sendToFlutter(pos.lat, pos.lng);
  });

  // C. Clicking the map to teleport the pin
  map.addListener("click", (e) => {
    const pos = e.latLng;
    marker.position = pos;
    reverseGeocode(pos);
    sendToFlutter(pos.lat(), pos.lng());
  });
}

// Optional: Turn coordinates into a readable address in the search bar
function reverseGeocode(latLng) {
  geocoder.geocode({ location: latLng }, (results, status) => {
    if (status === "OK" && results[0]) {
      document.getElementById("pac-input").value = results[0].formatted_address;
    }
  });
}

function sendToFlutter(lat, lng) {
  const data = { action: "locationPicked", lat: lat, lng: lng };
  console.log("📍 Sending to Flutter:", data);
  
  if (window.FlutterChan) {
    window.FlutterChan.postMessage(JSON.stringify(data));
  } else {
    window.parent.postMessage(data, "*");
  }
}

// Initial position from Flutter
window.addEventListener("message", (event) => {
  if (event.data.action === "setInitialPos") {
    const pos = { lat: event.data.lat, lng: event.data.lng };
    if (map && marker) {
        map.setCenter(pos);
        marker.position = pos;
    }
  }
});
