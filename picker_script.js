let map, marker, geocoder;

window.initPickerMap = async function() {
  try {
    // 1. Load Libraries
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
    });

    // 2. Setup the NEW 2025 Autocomplete Component
    const autocompleteWidget = document.getElementById("pac-input");
    
    // Add to Map UI
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(autocompleteWidget);

    // Modern Listener for the new component
    autocompleteWidget.addEventListener('gmp-placeselect', async (e) => {
      const place = e.detail.place;

      // Ensure geometry is fetched (Standard for the new component)
      if (!place.geometry) {
        await place.fetchFields({ fields: ['geometry', 'location', 'formatted_address'] });
      }

      if (place.geometry && place.geometry.location) {
        const pos = place.geometry.location;
        map.setCenter(pos);
        marker.position = pos;
        map.setZoom(17);
        sendToFlutter(pos.lat(), pos.lng());
      }
    });

    // 3. Manual Pin Listeners
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

    console.log("✅ Map Initialized with 2025 PlaceAutocompleteElement");
  } catch (e) {
    console.error("❌ Map Initialization Failed:", e);
  }
};

// --- EDIT HANDLER ---
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
       // Since the new widget handles its own input, we don't strictly need to 
       // update the text value manually, but it's good for UX.
       const widget = document.getElementById("pac-input");
       // Note: the widget might require internal value setting depending on browser
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
