let map;
let marker;
let geocoder;

async function initPickerMap() {
  // 1. Properly await the libraries
  await google.maps.importLibrary("maps");
  await google.maps.importLibrary("marker");
  await google.maps.importLibrary("places");
  await google.maps.importLibrary("geocoding");

  // 2. Access the namespace AFTER the await
  const Map = google.maps.Map;
  const AdvancedMarkerElement = google.maps.marker.AdvancedMarkerElement;
  const SearchBox = google.maps.places.SearchBox;
  const ControlPosition = google.maps.ControlPosition; // This is the fix
  geocoder = new google.maps.Geocoder();

  // 3. Initialize Map
  map = new Map(document.getElementById("map"), {
    center: { lat: 32.028, lng: 35.704 },
    zoom: 15,
    mapId: "48c2bb983bd19c1c44d95cb7",
    streetViewControl: false,
    mapTypeControl: true,
  });

  // 4. Create the Picker Marker
  marker = new AdvancedMarkerElement({
    map: map,
    position: { lat: 32.028, lng: 35.704 },
    gmpDraggable: true,
    title: "اسحب لتحديد الموقع"
  });

  // 5. Setup Search Box
  const input = document.getElementById("pac-input");
  const searchBox = new SearchBox(input);
  
  // Safely push the control
  if (ControlPosition && ControlPosition.TOP_LEFT) {
    map.controls[ControlPosition.TOP_LEFT].push(input);
  }

  // --- REST OF YOUR LISTENERS ---
  searchBox.addListener("places_changed", () => {
    const places = searchBox.getPlaces();
    if (places.length === 0) return;
    const pos = places[0].geometry.location;
    map.setCenter(pos);
    marker.position = pos;
    sendToFlutter(pos.lat(), pos.lng());
  });

  marker.addListener("dragend", () => {
    const pos = marker.position;
    reverseGeocode(pos);
    sendToFlutter(pos.lat, pos.lng);
  });

  map.addListener("click", (e) => {
    const pos = e.latLng;
    marker.position = pos;
    reverseGeocode(pos);
    sendToFlutter(pos.lat(), pos.lng());
  });
}

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
