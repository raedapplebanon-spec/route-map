// Ensure globals are defined
window.routeMarkers = [];
window.availableMarkers = [];
let map, directionsService, directionsRenderer, infoWindow;
let mapReady = false;
let isFirstLoad = true;

const MY_MAP_ID = "48c2bb983bd19c1c44d95cb7";

// 1. HAIVERSINE & CLUSTERING
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function groupCloseLocations(stops, tolerance = 15) {
    const clusters = [];
    stops.forEach(stop => {
        let placed = false;
        for (const c of clusters) {
            const d = haversineDistance(c.lat, c.lng, parseFloat(stop.lat), parseFloat(stop.lng));
            if (d < tolerance) {
                c.items.push(stop);
                if (stop.isStart === true) c.isStart = true;
                if (stop.isFinal === true) c.isFinal = true;
                if (stop.stopType === 'assistant') c.stopType = 'assistant';
                if (stop.timeShift) c.timeShift = stop.timeShift;
                placed = true;
                break;
            }
        }
        if (!placed) {
            clusters.push({
                lat: parseFloat(stop.lat),
                lng: parseFloat(stop.lng),
                items: [stop],
                isStart: stop.isStart === true,
                isFinal: stop.isFinal === true,
                stopType: stop.stopType,
                timeShift: stop.timeShift,
                hideMarker: (stop.hideMarker === true || stop.hideMarker === 'true')
            });
        }
    });
    return clusters;
}

// 2. UI UPDATES
function updateRouteSummary(km, minutes) {
    const summaryBox = document.getElementById("route-summary");
    const summaryText = document.getElementById("summary-text");
    if (summaryBox && summaryText) {
        summaryBox.classList.remove("hidden");
        summaryText.innerHTML = `المسافة: <b>${km} كم</b><br>الوقت: <b>${minutes} دقيقة</b>`;
    }
}

// 3. MAP INITIALIZATION (Called by Google Callback)
window.initMap = async function() {
    try {
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
        const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");

        infoWindow = new google.maps.InfoWindow();

        map = new Map(document.getElementById("map"), {
            center: { lat: 32.028031, lng: 35.704308 },
            zoom: 13,
            mapId: MY_MAP_ID,
        });

        const autocompleteWidget = document.getElementById("pac-input");
        map.controls[google.maps.ControlPosition.TOP_LEFT].push(autocompleteWidget);

        autocompleteWidget.addEventListener('gmp-placeselect', async (e) => {
            const place = e.detail.place;
            const query = (place.displayName || "").toLowerCase();
            const allMarkers = [...window.routeMarkers, ...window.availableMarkers];
            const found = allMarkers.find(m => m.names.some(name => name.toLowerCase().includes(query)));

            if (found) {
                map.setCenter(found.marker.position);
                map.setZoom(18);
                infoWindow.setContent(found.html);
                infoWindow.open(map, found.marker);
            } else {
                if (!place.geometry) await place.fetchFields({ fields: ['geometry', 'location'] });
                if (place.geometry) map.setCenter(place.geometry.location);
            }
        });

        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: { strokeColor: "#1a73e8", strokeOpacity: 0.8, strokeWeight: 5 },
        });

        mapReady = true;
        console.log("✅ Map and Libraries Ready");
        
        // Handle data that arrived before map was ready
        if (window.pendingData) {
            console.log("📦 Processing pending data...");
            window.setRouteData(window.pendingData.route, window.pendingData.available);
            window.pendingData = null;
        }
    } catch (err) {
        console.error("❌ initMap Error:", err);
    }
};

// 4. ROUTE DATA LOGIC
window.setRouteData = function(routeArray, availableArray) {
    if (!mapReady) {
        console.log("⏳ Map not ready. Storing data.");
        window.pendingData = { route: routeArray, available: availableArray };
        return;
    }

    // Clear old markers
    window.routeMarkers.forEach(obj => obj.marker.map = null);
    window.availableMarkers.forEach(obj => obj.marker.map = null);
    window.routeMarkers = [];
    window.availableMarkers = [];
    directionsRenderer.setDirections({ routes: [] });

    const bounds = new google.maps.LatLngBounds();

    const addMarker = (pos, title, html, color, text, studentNames) => {
        const pin = new google.maps.marker.PinElement({
            background: color,
            borderColor: "#FFFFFF",
            glyphColor: "#FFFFFF",
            glyphText: text 
        });

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: pos,
            content: pin.element,
        });

        marker.addListener("click", () => {
            infoWindow.setContent(html);
            infoWindow.open(map, marker);
        });

        return { marker, pin, names: studentNames, html: html, lat: pos.lat, lng: pos.lng };
    };

    const routeClusters = groupCloseLocations(routeArray);
    const availableClusters = groupCloseLocations(availableArray);

    routeClusters.forEach(cluster => {
        if (cluster.hideMarker) return;
        const pos = { lat: cluster.lat, lng: cluster.lng };
        bounds.extend(pos);

        let color = "#1a73e8"; 
        if (cluster.isStart || (cluster.stopType === 'assistant' && cluster.timeShift === 'AM')) color = "#00c853";
        if (cluster.isFinal || (cluster.stopType === 'assistant' && cluster.timeShift === 'PM')) color = "#d50000";

        let initialText = cluster.stopType === 'assistant' ? (cluster.timeShift === 'AM' ? "A" : "P") : "...";
        let namesArr = cluster.items.map(x => x.studentName || "طالب");

        let html = `<div style="color:black;text-align:right;direction:rtl;min-width:150px;">
                      <b>${cluster.stopType === 'assistant' ? "المساعد" : "محطة"}</b><hr>
                      ${namesArr.map(n => `<div>• ${n}</div>`).join('')}
                    </div>`;

        window.routeMarkers.push(addMarker(pos, "route", html, color, initialText, namesArr));
    });

    availableClusters.forEach(cluster => {
        const pos = { lat: cluster.lat, lng: cluster.lng };
        bounds.extend(pos);
        let namesArr = cluster.items.map(x => x.studentName);
        let html = `<div style="color:black;text-align:right;direction:rtl;"><b>خارج الجولة</b><hr>${namesArr.join('<br>')}</div>`;
        window.availableMarkers.push(addMarker(pos, "available", html, "#ff9100", cluster.items.length.toString(), namesArr));
    });

    if (routeClusters.length >= 2) calculateRoadRoute(routeClusters);
    if (!bounds.isEmpty() && isFirstLoad) {
        map.fitBounds(bounds);
        isFirstLoad = false;
    }
};

function calculateRoadRoute(clusters) {
  // 1. Identify the absolute Start and End (Driver/School)
  const startPoint = clusters.find(c => c.isStart);
  const endPoint = clusters.find(c => c.isFinal);
  
  if (!startPoint || !endPoint) return;

  // 2. Identify Assistants
  const assistantAM = clusters.find(c => c.stopType === 'assistant' && c.timeShift === 'AM');
  const assistantPM = clusters.find(c => c.stopType === 'assistant' && c.timeShift === 'PM');

  // 3. Filter out everyone else (Students)
  const studentWaypoints = clusters.filter(c => 
    c !== startPoint && 
    c !== endPoint && 
    c !== assistantAM && 
    c !== assistantPM
  );

  // 4. Construct the Waypoint Array in a specific order:
  // [Assistant AM (Fixed), ...Students (Optimized), Assistant PM (Fixed)]
  let finalWaypoints = [];

  if (assistantAM) {
    finalWaypoints.push({
      location: { lat: assistantAM.lat, lng: assistantAM.lng },
      stopover: true // Assistant AM must be first
    });
  }

  // Add students to the middle
  studentWaypoints.forEach(s => {
    finalWaypoints.push({
      location: { lat: s.lat, lng: s.lng },
      stopover: true
    });
  });

  if (assistantPM) {
    finalWaypoints.push({
      location: { lat: assistantPM.lat, lng: assistantPM.lng },
      stopover: true // Assistant PM must be last
    });
  }

  // 5. Call Directions Service
  directionsService.route({
    origin: { lat: startPoint.lat, lng: startPoint.lng },
    destination: { lat: endPoint.lat, lng: endPoint.lng },
    waypoints: finalWaypoints,
    travelMode: google.maps.TravelMode.DRIVING,
    // CRITICAL: Google will optimize the middle, 
    // but the array order determines the start/end of the waypoints
    optimizeWaypoints: true, 
  }, (result, status) => {
    if (status === "OK") {
      directionsRenderer.setDirections(result);
      
      // Update the Marker numbers (1, 2, 3...) on the map
      const route = result.routes[0];
      const waypointOrder = route.waypoint_order; // e.g. [0, 2, 1, 3]
      
      // We need to map the optimized order back to our markers
      // Note: Assistant AM is index 0 in finalWaypoints, Assistant PM is the last index
      updateMarkerGylphs(result, finalWaypoints);

      let dist = 0, dur = 0;
      route.legs.forEach(leg => { 
        dist += leg.distance.value; 
        dur += leg.duration.value; 
      });
      updateRouteSummary((dist / 1000).toFixed(1), Math.round(dur / 60));
    }
  });
}

function updateMarkerGylphs(result, finalWaypoints) {
  const route = result.routes[0];
  const order = route.waypoint_order; 

  // The 'order' array from Google tells us how it re-arranged the waypoints list
  // We match these back to our AdvancedMarkerElement positions
  order.forEach((originalIdx, stepIdx) => {
    const latLng = finalWaypoints[originalIdx].location;
    const stopNumber = (stepIdx + 1).toString();

    const markerObj = window.routeMarkers.find(m => 
      Math.abs(m.lat - latLng.lat) < 0.0001 && 
      Math.abs(m.lng - latLng.lng) < 0.0001
    );

    if (markerObj && markerObj.pin) {
      markerObj.pin.glyphText = stopNumber;
    }
  });
}

