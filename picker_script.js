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

    // 2. CREATE the Search Component
    // We create a container DIV to force the layout style
    const searchContainer = document.createElement("div");
    searchContainer.style.margin = "10px";
    searchContainer.style.zIndex = "1"; // Ensure it sits on top

    // Create the Google Autocomplete Element
    autocomplete = new PlaceAutocompleteElement();
    
    // ⭐ CRITICAL FIX: Apply the ID to the ACTUAL DOM Element
    autocomplete.element.id = "pac-input";
    
    // ⭐ FORCE STYLING: Ensure it has width and background
    autocomplete.element.style.width = "300px";
    autocomplete.element.style.backgroundColor = "white";
    autocomplete.element.style.borderRadius = "8px";
    autocomplete.element.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";

    // Put the widget inside our container
    searchContainer.appendChild(autocomplete.element);

    // Add the Container to the Map UI (Top Left)
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(searchContainer);

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
    });

    // C. Map Click Listener
    map.addListener("click", (e) => {
      const pos = e.latLng;
      marker.position = pos;
      sendToFlutter(pos.lat(), pos.lng());
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
