// --- Globals ---
let map, marker, geocoder, autocomplete;

// 1. ATTACH IMMEDIATELY
window.initPickerMap = async function() {
  try {
    // Load Libraries
    await google.maps.importLibrary("maps");
    await google.maps.importLibrary("marker");
    const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");
    await google.maps.importLibrary("geocoding");

    geocoder = new google.maps.Geocoder();

    const defaultPos = { lat: 32.0280, lng: 35.7043 };
    
    map = new google.maps.Map(document.getElementById("map"), {
      center: defaultPos,
      zoom: 15,
      mapId: "48c2bb983bd19c1c44d95cb7",
      mapTypeControl: false,
      streetViewControl: false
    });

    marker = new google.maps.marker.AdvancedMarkerElement({
      map: map,
      position: defaultPos,
      gmpDraggable: true,
      title: "Move to select location"
    });

    // 2. CREATE the Search Component Programmatically
    // This creates the new 2025 widget
    autocomplete = new PlaceAutocompleteElement();
    autocomplete.id = "pac-input"; // Apply the ID for CSS styling
    // Note: 'placeholder' property might not be directly supported on the class in all versions, 
    // but the component renders its own internal text.

    // Add to Map UI (Top Left)
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(autocomplete.element);

    // 3. LISTENERS

    // A. Search Box Listener
    autocomplete.addEventListener('gmp-placeselect', async (e) => {
      const place = e.detail.place;
      
      // Ensure geometry is fetched
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

    // B. Marker Drag Listener
    marker.addListener("dragend", () => {
      const pos = marker.position;
      sendToFlutter(pos.lat, pos.lng);
      // Optional: Try to update text (Note: The new widget is often read-only for programatic text updates)
      // reverseGeocode(pos); 
    });

    // C. Map Click Listener
    map.addListener("click", (e) => {
      const pos = e.latLng;
      marker.position = pos;
      sendToFlutter(pos.lat(), pos.lng());
      // reverseGeocode(pos);
    });

    console.log("✅ Picker Map Initialized Successfully");

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
      const checkMapInterval = setInterval(() => {
         if (map && marker) {
             clearInterval(checkMapInterval);
             map.setCenter(pos);
             marker.position = pos;
             map.setZoom(17);
         }
      }, 100);
    }
  }
});

/* Note: The new PlaceAutocompleteElement does not easily support 
   setting the text value arbitrarily (like '32.55, 35.66') via JS 
   because it expects a Place object. We rely on the marker for visual feedback.
*/
function reverseGeocode(latLng) {
  // Logic reserved for standard input boxes. 
  // The new 2025 widget manages its own state strictly.
}

// Send data back to Flutter
function sendToFlutter(lat, lng) {
  const data = { action: "locationPicked", lat: lat, lng: lng };
  if (window.FlutterChan) {
    window.FlutterChan.postMessage(JSON.stringify(data));
  } else {
    window.parent.postMessage(data, "*");
  }
}

// Safety Trigger
if (typeof google !== 'undefined' && google.maps) {
    window.initPickerMap();
}
