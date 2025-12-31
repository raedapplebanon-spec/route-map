let map, marker, geocoder;

// 1. ATTACH IMMEDIATELY: Using this syntax ensures the function is on the window 
// before the rest of the script even finishes executing.
window.initPickerMap = async function() {
  try {
    // Load Libraries
    await google.maps.importLibrary("maps");
    await google.maps.importLibrary("marker");
    await google.maps.importLibrary("places");
    await google.maps.importLibrary("geocoding");

    geocoder = new google.maps.Geocoder();

    const defaultPos = { lat: 32.0280, lng: 35.7043 };
    
    map = new google.maps.Map(document.getElementById("map"), {
      center: defaultPos,
      zoom: 15,
      mapId: "48c2bb983bd19c1c44d95cb7",
    });

    marker = new google.maps.marker.AdvancedMarkerElement({
      map: map,
      position: defaultPos,
      gmpDraggable: true,
      title: "اسحب الدبوس لتحديد الموقع"
    });

    // --- LISTENERS ---
    marker.addListener("dragend", () => {
      const pos = marker.position;
      sendToFlutter(pos.lat, pos.lng);
      reverseGeocode(pos);
    });

    map.addListener("click", (e) => {
      const pos = e.latLng;
      marker.position = pos;
      sendToFlutter(pos.lat(), pos.lng());
      reverseGeocode(pos);
    });

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

    console.log("✅ Map Initialized Successfully");
  } catch (e) {
    console.error("❌ Map Initialization Failed:", e);
  }
};

// 2. THE EDIT HANDLER (Stays outside)
window.addEventListener("message", (event) => {
  if (event.data.action === "setInitialPos") {
    const lat = parseFloat(event.data.lat);
    const lng = parseFloat(event.data.lng);
    if (lat && lat !== 0) {
      const pos = { lat, lng };
      if (map && marker) {
        map.setCenter(pos);
        marker.position = pos;
        map.setZoom(17);
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
  if (window.FlutterChan) {
    window.FlutterChan.postMessage(JSON.stringify(data));
  } else {
    window.parent.postMessage(data, "*");
  }
}

// 3. SAFETY TRIGGER: If Google Maps finished loading before this script was ready,
// it might have missed the "callback". This forces it to run.
if (typeof google !== 'undefined' && google.maps) {
    window.initPickerMap();
}
