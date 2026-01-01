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
      
      // ✅ LAYOUT CONFIGURATION
      mapTypeControl: true,
      mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_RIGHT // Satellite button goes to Right
      },
      streetViewControl: false,
      fullscreenControl: false
    });

    // 3. Initialize Marker
    marker = new google.maps.marker.AdvancedMarkerElement({
      map: map,
      position: defaultPos,
      gmpDraggable: true
    });

    // 4. SETUP SEARCH POSITION
    const searchBar = document.getElementById("pac-input");
    
    // ✅ Search bar goes to Left (Cleanly inside the map)
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(searchBar);

    // 5. SEARCH LISTENER (THE JUMP FIX)
    searchBar.addEventListener('gmp-placeselect', async ({ detail }) => {
      const place = detail.place;
      
      if (!place) return;

      // Force fetch the 'location' field
      await place.fetchFields({ 
        fields: ['location', 'viewport', 'formattedAddress'] 
      });

      // Verification Log
      console.log("📍 Jump to:", place.location);

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

    console.log("✅ Map Initialized");

  } catch (e) {
    console.error("❌ Map Error:", e);
  }
};

// Helper: Handle updates
function updateFromMarker() {
  const pos = marker.position;
  const lat = (typeof pos.lat === 'function') ? pos.lat() : pos.lat;
  const lng = (typeof pos.lng === 'function') ? pos.lng() : pos.lng;
  
  sendToFlutter(lat, lng);
  
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

// Initial Position Handler
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
