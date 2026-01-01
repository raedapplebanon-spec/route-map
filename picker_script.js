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
      
      // 👇 NEW: Error trapping to see why it fails
      try {
          const place = detail.place;
          
          if (!place) {
            alert("❌ System Error: Place object is missing.");
            return;
          }

          // Fetch fields (This is usually where it fails if API is blocked)
          await place.fetchFields({ 
            fields: ['location', 'displayName', 'formattedAddress', 'viewport'] 
          });

          // Check if location exists
          if (!place.location) {
            alert("⚠️ No coordinates found for this place. Please try a different specific location.");
            return;
          }

          // MOVE THE MAP
          if (place.viewport) {
            map.fitBounds(place.viewport);
          } else {
            map.setCenter(place.location);
            map.setZoom(17);
          }

          // MOVE THE MARKER
          marker.position = place.location;

          // Send data
          sendToFlutter(place.location.lat, place.location.lng);

      } catch (error) {
          // 🚨 THIS ALERT WILL TELL US THE REAL PROBLEM
          console.error(error);
          alert("❌ Error fetching location: " + error.message + "\n\nCheck your console for details.");
      }
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

function sendToFlutter(lat, lng) {
  const data = { action: "locationPicked", lat: lat, lng: lng };
  if (window.FlutterChan) {
    window.FlutterChan.postMessage(JSON.stringify(data));
  } else {
    window.parent.postMessage(data, "*");
  }
}

if (typeof google !== 'undefined' && google.maps) {
   // window.initPickerMap(); 
}
