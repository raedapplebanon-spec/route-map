// --- Globals ---
let map, marker, geocoder;

// 1. ATTACH IMMEDIATELY
window.initPickerMap = async function() {
  try {
    // Load Libraries (Matching your working code)
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
      mapTypeControl: false,
      streetViewControl: false
    });

    marker = new google.maps.marker.AdvancedMarkerElement({
      map: map,
      position: defaultPos,
      gmpDraggable: true,
      title: "Move to select location"
    });

    // 2. SETUP SEARCH (Matching your working Route Map logic)
    // We grab the element from the HTML instead of creating it in JS
    const autocompleteWidget = document.getElementById("pac-input");
    
    // Add to Map UI (Top Left)
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(autocompleteWidget);

    // 3. LISTENERS

    // A. Search Box Listener (gmp-placeselect)
    autocompleteWidget.addEventListener('gmp-placeselect', async (e) => {
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
        
        // Update the visual text in the box if possible
        if (place.formatted_address) {
            autocompleteWidget.value = place.formatted_address;
        }
      }
    });

    // B. Marker Drag Listener
    marker.addListener("dragend", () => {
      const pos = marker.position;
      sendToFlutter(pos.lat, pos.lng);
      reverseGeocode(pos);
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
    
    if (lat && lat !== 0) {
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
      const widget = document.getElementById("pac-input");
      if (widget) {
          // Update the text inside the component
          widget.value = results[0].formatted_address;
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
    window.initPickerMap();
}
