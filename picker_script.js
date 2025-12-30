let map;
let marker;

async function initPickerMap() {
  const { Map, ControlPosition } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  const { SearchBox } = await google.maps.importLibrary("places");

  // Initialize Map
  map = new Map(document.getElementById("map"), {
    center: { lat: 32.028, lng: 35.704 },
    zoom: 15,
    mapId: "48c2bb983bd19c1c44d95cb7", // Reusing your Map ID
  });

  // 1. Create a Draggable Marker
  marker = new AdvancedMarkerElement({
    map: map,
    position: { lat: 32.028, lng: 35.704 },
    gmpDraggable: true,
    title: "اسحب لتحديد الموقع"
  });

  // 2. Search Box logic
  const input = document.getElementById("pac-input");
  const searchBox = new SearchBox(input);
  map.controls[ControlPosition.TOP_LEFT].push(input);

  searchBox.addListener("places_changed", () => {
    const places = searchBox.getPlaces();
    if (places.length === 0) return;
    const pos = places[0].geometry.location;
    map.setCenter(pos);
    marker.position = pos;
    sendToFlutter(pos.lat(), pos.lng());
  });

  // 3. Update position when dragged
  marker.addListener("dragend", () => {
    const pos = marker.position;
    sendToFlutter(pos.lat, pos.lng);
  });

  // 4. Update position when map is clicked
  map.addListener("click", (e) => {
    const pos = e.latLng;
    marker.position = pos;
    sendToFlutter(pos.lat(), pos.lng());
  });
}

function sendToFlutter(lat, lng) {
  const data = { action: "locationPicked", lat: lat, lng: lng };
  
  // Detect Windows WebView
  if (window.FlutterChan) {
    window.FlutterChan.postMessage(JSON.stringify(data));
  } 
  // Detect Web IFrame
  else {
    window.parent.postMessage(data, "*");
  }
}

// Listener for initial position from Flutter
window.addEventListener("message", (event) => {
  if (event.data.action === "setInitialPos") {
    const pos = { lat: event.data.lat, lng: event.data.lng };
    map.setCenter(pos);
    marker.position = pos;
  }
});
