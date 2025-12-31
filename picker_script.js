let map, marker, geocoder;

window.initPickerMap = async function() {
  try {
    // 1. Load Libraries (Added 'places' is still required)
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
      streetViewControl: false, // Optional: keeps UI clean
    });

    marker = new google.maps.marker.AdvancedMarkerElement({
      map: map,
      position: defaultPos,
      gmpDraggable: true,
      title: "اسحب الدبوس لتحديد الموقع"
    });

    // --- MARKER LISTENERS ---
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

    // --- NEW AUTOCOMPLETE SETUP (Replaces SearchBox) ---
    const input = document.getElementById("pac-input");
    
    // Autocomplete is more modern and provides better suggestions
    const autocomplete = new google.maps.places.Autocomplete(input, {
      fields: ["geometry", "formatted_address", "name"],
      origin: map.getCenter(),
    });

    map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

    // Bind autocomplete to map bounds so it searches nearby first
    autocomplete.bindTo("bounds", map);

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      
      if (!place.geometry || !place.geometry.location) {
        console.log("No details available for input: '" + place.name + "'");
        return;
      }

      const pos = place.geometry.location;
      map.setCenter(pos);
      marker.position = pos;
      
      // Update the input text to the clean formatted address
      input.value = place.formatted_address || place.name;
      
      sendToFlutter(pos.lat(), pos.lng());
    });

    console.log("✅ Map Initialized with Autocomplete Successfully");
  } catch (e) {
    console.error("❌ Map Initialization Failed:", e);
  }
};

// 2. THE EDIT HANDLER
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

if (typeof google !== 'undefined' && google.maps) {
    window.initPickerMap();
}
