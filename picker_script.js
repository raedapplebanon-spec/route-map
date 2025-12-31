let map;
let marker;
let geocoder;
let isReady = false; // The Gate

async function initPickerMap() {
  await google.maps.importLibrary("maps");
  await google.maps.importLibrary("marker");
  await google.maps.importLibrary("places");
  await google.maps.importLibrary("geocoding");

  const { Map, ControlPosition } = google.maps;
  const { AdvancedMarkerElement } = google.maps.marker;
  const { SearchBox } = google.maps.places;
  geocoder = new google.maps.Geocoder();

  map = new Map(document.getElementById("map"), {
    center: { lat: 32.028, lng: 35.704 }, // Default to Jordan, not the ocean
    zoom: 15,
    mapId: "48c2bb983bd19c1c44d95cb7",
  });

  marker = new AdvancedMarkerElement({
    map: map,
    position: map.getCenter(),
  });

  map.addListener("center_changed", () => {
    marker.position = map.getCenter();
  });

  map.addListener("idle", () => {
    // ONLY send to Flutter if the map is "Ready" (after initial position is loaded)
    if (!isReady) return; 

    const pos = map.getCenter();
    reverseGeocode(pos);
    sendToFlutter(pos.lat(), pos.lng());
  });

  const input = document.getElementById("pac-input");
  const searchBox = new SearchBox(input);
  map.controls[ControlPosition.TOP_LEFT].push(input);

  searchBox.addListener("places_changed", () => {
    const places = searchBox.getPlaces();
    if (places.length === 0) return;
    map.setCenter(places[0].geometry.location);
  });
}

// EDIT MODE: Receive initial position
window.addEventListener("message", (event) => {
  if (event.data.action === "setInitialPos") {
    const pos = { 
        lat: parseFloat(event.data.lat), 
        lng: parseFloat(event.data.lng) 
    };
    
    // If coordinates are 0 or null, don't move (prevents ocean bug)
    if (!pos.lat || pos.lat === 0) return;

    if (map) {
      map.setCenter(pos);
      map.setZoom(17);
      
      // Open the gate! Now the user can move the map and updates will send
      setTimeout(() => { isReady = true; }, 1000); 
    }
  }
});

function sendToFlutter(lat, lng) {
  const data = { action: "locationPicked", lat: lat, lng: lng };
  if (window.FlutterChan) {
    window.FlutterChan.postMessage(JSON.stringify(data));
  } else {
    window.parent.postMessage(data, "*");
  }
}
