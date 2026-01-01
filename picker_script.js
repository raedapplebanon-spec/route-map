// --- Globals ---
let map, marker, geocoder, autocomplete;

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

    // 4. SETUP SEARCH (The Standard Way)
    const input = document.getElementById("pac-input");
    
    // Create the Autocomplete object
    autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.bindTo("bounds", map);

    // Push to top-left controls
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

    // 5. LISTENERS

    // A. Search Box Listener (Standard 'place_changed' event)
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();

      if (!place.geometry || !place.geometry.location) {
        // User entered the name of a Place that was not suggested
        window.alert("No details available for input: '" + place.name + "'");
        return;
      }

      // If the place has a geometry, then present it on a map.
      if (place.geometry.viewport) {
        map.fitBounds(place.geometry.viewport);
      } else {
        map.setCenter(place.geometry.location);
        map.setZoom(17);
      }

      marker.position = place.geometry.location;
      
      // Send data to Flutter
      sendToFlutter(place.geometry.location.lat(), place.geometry.location.lng());
    });

    // B. Marker Drag Listener
    marker.addListener("dragend", () => {
      const pos = marker.position;
      // Note: AdvancedMarker returns lat/lng as plain numbers or null, check access
      // If using AdvancedMarkerElement, position is often LatLng object, or {lat, lng} interface
      // Safest way to read:
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
// --- EDIT HANDLER ---
window.addEventListener("message", (event) => {
  if (event.data.action === "setInitialPos") {
    const lat = parseFloat(event.data.lat);
    const lng = parseFloat(event.data.lng);
    
    // Ensure lat/lng are valid numbers
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
      const pos = { lat: lat, lng: lng };
      
      const checkMapInterval = setInterval(() => {
         // Check if map, marker, AND the internal position property exist
         if (map && marker) {
             clearInterval(checkMapInterval);
             
             // 1. Move Map
             map.setCenter(pos);
             map.setZoom(17);
             
             // 2. Move Marker (AdvancedMarkerElement handles simple {lat, lng} objects fine)
             marker.position = pos;
             
             // 3. Update Text
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
       const input = document.getElementById("pac-input");
       if (input) {
           input.value = results[0].formatted_address;
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
    // Fallback for iframe/web
    window.parent.postMessage(data, "*");
  }
}

// Safety Trigger
if (typeof google !== 'undefined' && google.maps) {
   // window.initPickerMap(); // Usually callback handles this, but keep if needed
}
