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
    // Default: Amman, Jordan
    const defaultPos = { lat: 31.9539, lng: 35.9106 };

    // 2. Initialize Map
    map = new google.maps.Map(document.getElementById("map"), {
      center: defaultPos,
      zoom: 13,
      mapId: "48c2bb983bd19c1c44d95cb7",
      
      // ✅ LAYOUT: Satellite on Right
      mapTypeControl: true, 
      mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_RIGHT
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

    // 4. SETUP SEARCH (Standard Method)
    const input = document.getElementById("pac-input");
    
    // ➤ Push Search Bar to Top Left (Inside the map)
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

    // Connect logic
    autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.bindTo("bounds", map);

    // 5. SEARCH LISTENER (The Jump)
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();

      if (!place.geometry || !place.geometry.location) {
        window.alert("No details available for input: '" + place.name + "'");
        return;
      }

      // A. Move Map
      if (place.geometry.viewport) {
        map.fitBounds(place.geometry.viewport);
      } else {
        map.setCenter(place.geometry.location);
        map.setZoom(17);
      }

      // B. Move Marker
      marker.position = place.geometry.location;

      // C. Send Data
      sendToFlutter(place.geometry.location.lat(), place.geometry.location.lng());
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
    console.error("❌ Map Initialization Failed:", e);
  }
};

// Helper: Update Search Text & App Data
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

// Send Data to App
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
