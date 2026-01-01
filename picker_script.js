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
      mapTypeControl: true,       // ✅ ENABLED SATELLITE VIEW BUTTON
      streetViewControl: false,
      fullscreenControl: false
    });

    // 3. Initialize Marker
    marker = new google.maps.marker.AdvancedMarkerElement({
      map: map,
      position: defaultPos,
      gmpDraggable: true,
      title: "Selected Location"
    });

    // 4. SETUP SEARCH LISTENER
    const autocompleteComponent = document.getElementById("pac-input");

    // ⚠️ IMPORTANT: We DO NOT push to map.controls anymore.
    // This allows the CSS to float it in the center.

    // 5. LISTENER: Handle the Search Jump
    autocompleteComponent.addEventListener('gmp-placeselect', async ({ detail }) => {
      const place = detail.place;
      
      if (!place) return;

      // Fetch Location Data
      await place.fetchFields({ 
        fields: ['location', 'formattedAddress', 'viewport'] 
      });

      // Check if we got coordinates
      if (!place.location) {
        console.error("❌ No location coordinates found.");
        return;
      }

      // A. JUMP TO LOCATION
      if (place.viewport) {
        map.fitBounds(place.viewport);
      } else {
        map.setCenter(place.location);
        map.setZoom(17);
      }

      // B. MOVE MARKER
      marker.position = place.location;

      // C. SEND DATA
      sendToFlutter(place.location.lat, place.location.lng);
    });

    // B. Marker Drag Listener
    marker.addListener("dragend", () => {
      const pos = marker.position;
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

    console.log("✅ Picker Map Initialized");

  } catch (e) {
    console.error("❌ Map Initialization Failed:", e);
  }
};

// --- EDIT HANDLER ---
window.addEventListener("message", (event) => {
  if (event.data.action === "setInitialPos") {
    const lat = parseFloat(event.data.lat);
    const lng = parseFloat(event.data.lng);
    
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
      const pos = { lat, lng };
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

// Update the Search Box text when pin is moved manually
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

// Send data back to Flutter
function sendToFlutter(lat, lng) {
  const data = { action: "locationPicked", lat: lat, lng: lng };
  if (window.FlutterChan) {
    window.FlutterChan.postMessage(JSON.stringify(data));
  } else {
    window.parent.postMessage(data, "*");
  }
}
