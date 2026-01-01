// --- Globals ---
let map, marker, geocoder;

window.initPickerMap = async function() {
  try {
    // 1. Load Libraries
    await google.maps.importLibrary("maps");
    await google.maps.importLibrary("marker");
    await google.maps.importLibrary("places");
    await google.maps.importLibrary("geocoding");

    geocoder = new google.maps.Geocoder();
    // Default: Jordan
    const defaultPos = { lat: 32.0280, lng: 35.7043 };

    // 2. Initialize Map
    map = new google.maps.Map(document.getElementById("map"), {
      center: defaultPos,
      zoom: 15,
      mapId: "48c2bb983bd19c1c44d95cb7", // Your Map ID
      mapTypeControl: false,
      streetViewControl: false
    });

    // 3. Initialize Marker
    marker = new google.maps.marker.AdvancedMarkerElement({
      map: map,
      position: defaultPos,
      gmpDraggable: true,
      title: "Selected Location"
    });

    // 4. SETUP SEARCH LISTENER
    // We target your <gmp-place-autocomplete> element
    const autocompleteComponent = document.getElementById("pac-input");
    
    // Add the search box to the map (top-left)
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(autocompleteComponent);

    // 5. THE FIX: Handle the Search Selection
    autocompleteComponent.addEventListener('gmp-placeselect', async ({ detail }) => {
      const place = detail.place;
      
      // If the API returns nothing, stop.
      if (!place) return;

      // Fetch the location data (Network Request)
      await place.fetchFields({ 
        fields: ['location', 'displayName', 'formattedAddress', 'viewport'] 
      });

      // If no location data came back, we cannot move the map.
      if (!place.location) {
        console.error("❌ Place found, but no location coordinates available.");
        return;
      }

      // --- LOGIC TO JUMP TO PLACE ---
      
      // 1. Update Marker immediately
      marker.position = place.location;

      // 2. Move Map Camera
      if (place.viewport) {
        // If it's a city/region, zoom to fit
        map.fitBounds(place.viewport);
      } else {
        // If it's a specific building, center on it
        map.setCenter(place.location);
        map.setZoom(17);
      }

      // 3. Send data to your App
      sendToFlutter(place.location.lat, place.location.lng);
    });

    // B. Marker Drag Listener
    marker.addListener("dragend", () => {
      const pos = marker.position;
      // Get lat/lng safely
      const lat = (typeof pos.lat === 'function') ? pos.lat() : pos.lat;
      const lng = (typeof pos.lng === 'function') ? pos.lng() : pos.lng;
      
      sendToFlutter(lat, lng);
      reverseGeocode({ lat, lng });
    });

    // C. Map Click Listener
    map.addListener("click", (e) => {
      const pos = e.latLng;
      marker.position = pos;
      sendToFlutter(pos.lat(), pos.lng());
      reverseGeocode(pos);
    });

    console.log("✅ Map Initialized");

  } catch (e) {
    console.error("❌ Map Error:", e);
  }
};

// --- HELPER: Set Initial Position (from App) ---
window.addEventListener("message", (event) => {
  if (event.data.action === "setInitialPos") {
    const lat = parseFloat(event.data.lat);
    const lng = parseFloat(event.data.lng);
    
    if (!isNaN(lat) && !isNaN(lng)) {
      const pos = { lat: lat, lng: lng };
      
      // Wait for map to be ready, then jump
      const checkMapInterval = setInterval(() => {
         if (map && marker) {
             clearInterval(checkMapInterval);
             map.setCenter(pos);
             marker.position = pos;
             map.setZoom(17);
             reverseGeocode(pos);
         }
      }, 100);
    }
  }
});

// --- HELPER: Get Address from Pin ---
function reverseGeocode(latLng) {
  if (!geocoder) return;
  geocoder.geocode({ location: latLng }, (results, status) => {
    if (status === "OK" && results[0]) {
       const component = document.getElementById("pac-input");
       if (component) {
           component.value = results[0].formatted_address;
       }
    }
  });
}

// --- HELPER: Send Data to Flutter ---
function sendToFlutter(lat, lng) {
  const data = { action: "locationPicked", lat: lat, lng: lng };
  if (window.FlutterChan) {
    window.FlutterChan.postMessage(JSON.stringify(data));
  } else {
    window.parent.postMessage(data, "*");
  }
}

// Check if loaded
if (typeof google !== 'undefined' && google.maps) {
   // window.initPickerMap(); 
}
