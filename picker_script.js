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
      mapId: "48c2bb983bd19c1c44d95cb7", // Ensure this Map ID is valid in your console
      mapTypeControl: false,
      streetViewControl: false
    });

    // 3. Initialize Marker
    marker = new google.maps.marker.AdvancedMarkerElement({
      map: map,
      position: defaultPos,
      gmpDraggable: true,
      title: "Move to select location"
    });

    // 4. SETUP SEARCH
    const autocompleteComponent = document.getElementById("pac-input");
    
    // Add to Map UI
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(autocompleteComponent);

    // 5. LISTENER: HANDLES THE JUMP
    autocompleteComponent.addEventListener('gmp-placeselect', async ({ detail }) => {
      const place = detail.place;
      
      console.log("📍 Place selected:", place); // Debug Log

      // Fetch the specific fields we need for the jump
      await place.fetchFields({ 
        fields: ['location', 'displayName', 'formattedAddress', 'viewport'] 
      });

      console.log("📍 Location data fetched:", place.location); // Debug Log

      // IF NO LOCATION, STOP
      if (!place.location) {
        console.error("❌ No location found for this place!");
        return;
      }

      // STEP A: MOVE THE MAP
      if (place.viewport) {
        // If the place is a city or region, zoom to fit the area
        map.fitBounds(place.viewport);
      } else {
        // If it's a specific building, jump directly to it
        map.setCenter(place.location);
        map.setZoom(17);
      }

      // STEP B: MOVE THE MARKER
      marker.position = place.location;

      // STEP C: SEND DATA
      sendToFlutter(place.location.lat, place.location.lng);
    });

    // B. Marker Drag Listener
    marker.addListener("dragend", () => {
      const pos = marker.position;
      // Handle different return types safely
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

// Safety Trigger
if (typeof google !== 'undefined' && google.maps) {
   // window.initPickerMap(); 
}
