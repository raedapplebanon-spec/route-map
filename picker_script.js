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
    const defaultPos = { lat: 32.0280, lng: 35.7043 };

    // 2. Initialize Map
    map = new google.maps.Map(document.getElementById("map"), {
      center: defaultPos,
      zoom: 15,
      mapId: "48c2bb983bd19c1c44d95cb7",
      mapTypeControl: true, // ✅ THIS ENABLES THE SATELLITE BUTTON
      streetViewControl: false,
      fullscreenControl: false
    });

    // 3. Initialize Marker
    marker = new google.maps.marker.AdvancedMarkerElement({
      map: map,
      position: defaultPos,
      gmpDraggable: true
    });

    // 4. SETUP SEARCH
    const searchBar = document.getElementById("pac-input");
    
    // 🛑 CRITICAL FIX: I removed "map.controls.push".
    // This allows the HTML/CSS to handle the position (Top-Center),
    // so it doesn't block the Satellite button.

    // 5. SEARCH LISTENER (THE JUMP FIX)
    searchBar.addEventListener('gmp-placeselect', async ({ detail }) => {
      const place = detail.place;
      
      if (!place) return;

      // Force fetch logic to ensure we get coordinates
      await place.fetchFields({ 
        fields: ['location', 'viewport', 'formattedAddress'] 
      });

      // A. JUMP TO LOCATION
      if (place.viewport) {
        map.fitBounds(place.viewport);
      } else if (place.location) {
        map.setCenter(place.location);
        map.setZoom(17);
      }

      // B. MOVE MARKER
      if (place.location) {
          marker.position = place.location;
          // Send data to app
          sendToFlutter(place.location.lat, place.location.lng);
      }
    });

    // 6. DRAG LISTENER
    marker.addListener("dragend", () => {
      updateFromMarker();
    });

    // 7. CLICK LISTENER
    map.addListener("click", (e) => {
      marker.position = e.latLng;
      updateFromMarker();
    });

    console.log("✅ Map Initialized Correctly");

  } catch (e) {
    console.error("❌ Map Error:", e);
  }
};

// Helper: Handle updates
function updateFromMarker() {
  const pos = marker.position;
  // Handle different data types safely
  const lat = (typeof pos.lat === 'function') ? pos.lat() : pos.lat;
  const lng = (typeof pos.lng === 'function') ? pos.lng() : pos.lng;
  
  sendToFlutter(lat, lng);
  
  // Update address text
  if (geocoder) {
      geocoder.geocode({ location: {lat, lng} }, (results, status) => {
        if (status === "OK" && results[0]) {
           document.getElementById("pac-input").value = results[0].formatted_address;
        }
      });
  }
}

// Send to App
function sendToFlutter(lat, lng) {
  const data = { action: "locationPicked", lat: lat, lng: lng };
  if (window.FlutterChan) {
      window.FlutterChan.postMessage(JSON.stringify(data));
  } else {
      window.parent.postMessage(data, "*");
  }
}

// Initial Position Handler (from App)
window.addEventListener("message", (event) => {
  if (event.data.action === "setInitialPos") {
    const lat = parseFloat(event.data.lat);
    const lng = parseFloat(event.data.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
         const pos = { lat, lng };
         const i = setInterval(() => {
             if (map && marker) {
                 clearInterval(i);
                 map.setCenter(pos);
                 marker.position = pos;
                 map.setZoom(17);
             }
         }, 100);
    }
  }
});
