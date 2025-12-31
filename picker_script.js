let map, marker, geocoder;

async function initPickerMap() {
  // 1. Load Libraries
  await google.maps.importLibrary("maps");
  await google.maps.importLibrary("marker");
  await google.maps.importLibrary("places");
  await google.maps.importLibrary("geocoding");

  geocoder = new google.maps.Geocoder();

  // 2. Initialize at your default location (Salt, Jordan)
  const defaultPos = { lat: 32.0280, lng: 35.7043 };
  
  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultPos,
    zoom: 15,
    mapId: "48c2bb983bd19c1c44d95cb7",
  });

  // 3. Create the Draggable Pin
  marker = new google.maps.marker.AdvancedMarkerElement({
    map: map,
    position: defaultPos,
    gmpDraggable: true,
    title: "اسحب الدبوس لتحديد الموقع"
  });

  // --- ACTIONS ---

  // When user stops dragging
  marker.addListener("dragend", () => {
    const pos = marker.position;
    sendToFlutter(pos.lat, pos.lng);
    reverseGeocode(pos);
  });

  // When user clicks the map to "teleport" the pin
  map.addListener("click", (e) => {
    const pos = e.latLng;
    marker.position = pos;
    sendToFlutter(pos.lat(), pos.lng());
    reverseGeocode(pos);
  });

  // 4. Search Box Setup
  const input = document.getElementById("pac-input");
  const searchBox = new google.maps.places.SearchBox(input);
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

  searchBox.addListener("places_changed", () => {
    const places = searchBox.getPlaces();
    if (places.length === 0) return;
    const pos = places[0].geometry.location;
    map.setCenter(pos);
    marker.position = pos;
    sendToFlutter(pos.lat(), pos.lng());
  });
}

// 5. THE EDIT HANDLER: Listen for existing coordinates from Flutter
window.addEventListener("message", (event) => {
  if (event.data.action === "setInitialPos") {
    const lat = parseFloat(event.data.lat);
    const lng = parseFloat(event.data.lng);

    // If coordinates are 0, null, or invalid, ignore them (prevents ocean bug)
    if (lat && lat !== 0) {
      const pos = { lat, lng };
      if (map && marker) {
        map.setCenter(pos);
        marker.position = pos;
        map.setZoom(17);
        console.log("📍 Edit Mode: Map jumped to existing location.");
      }
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
  // Windows Support
  if (window.FlutterChan) {
    window.FlutterChan.postMessage(JSON.stringify(data));
  } 
  // Web Support
  else {
    window.parent.postMessage(data, "*");
  }
}

// Global assignment for the callback
window.initPickerMap = initPickerMap;
