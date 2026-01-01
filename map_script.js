// --- Globals ---
window.routeMarkers = [];
window.availableMarkers = [];
let map, directionsService, directionsRenderer, infoWindow;
let mapReady = false;
let isFirstLoad = true;

const MY_MAP_ID = "48c2bb983bd19c1c44d95cb7";

// 1. HELPER: Calculate Distance
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 2. HELPER: Group nearby stops (UPDATED FOR ROBUST ASSISTANT DETECTION)
function groupCloseLocations(stops, tolerance = 15) {
    const clusters = [];
    stops.forEach(stop => {
        let placed = false;
        
        // Normalize input data to ensure matching works
        const type = (stop.stopType || "").toLowerCase().trim();
        const shift = (stop.timeShift || "").toUpperCase().trim();

        for (const c of clusters) {
            const d = haversineDistance(c.lat, c.lng, parseFloat(stop.lat), parseFloat(stop.lng));
            if (d < tolerance) {
                c.items.push(stop);
                
                // FORCE UPDATE: If this new stop is Start/End/Assistant, upgrade the cluster
                if (stop.isStart === true) c.isStart = true;
                if (stop.isFinal === true) c.isFinal = true;
                
                // If ANYONE in this group is an assistant, the whole group is an assistant stop
                if (type === 'assistant') {
                    c.stopType = 'assistant';
                    // Capture the shift (AM/PM) from the assistant
                    if (shift) c.timeShift = shift;
                }
                
                c.hideMarker = c.hideMarker && (stop.hideMarker === true || stop.hideMarker === 'true');
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
                stopType: type, // Store normalized type
                timeShift: shift, // Store normalized shift
                hideMarker: (stop.hideMarker === true || stop.hideMarker === 'true')
            });
        }
    });
    return clusters;
}

// 3. UI: Update Summary
function updateRouteSummary(km, minutes) {
    const summaryBox = document.getElementById("route-summary");
    const summaryText = document.getElementById("summary-text");
    if (summaryBox && summaryText) {
        summaryBox.classList.remove("hidden");
        summaryText.innerHTML = "المسافة: <b>" + km + " كم</b><br>الوقت: <b>" + minutes + " دقيقة</b>";
    }
}

// 4. MAIN: Initialize Map
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
            mapTypeControl: true,
            streetViewControl: true,
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
        console.log("✅ Map Initialized Successfully");

        if (window.pendingData) {
            window.setRouteData(window.pendingData.route, window.pendingData.available);
            window.pendingData = null;
        }

    } catch (e) {
        console.error("❌ initMap Failed:", e);
    }
};

// 5. DATA HANDLER
window.setRouteData = function(routeArray, availableArray) {
    if (!mapReady) {
        window.pendingData = { route: routeArray, available: availableArray };
        return;
    }

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

    // Use the Updated Grouping Logic
    const routeClusters = groupCloseLocations(routeArray);
    const availableClusters = groupCloseLocations(availableArray);

    routeClusters.forEach(cluster => {
        if (cluster.hideMarker) return;
        const pos = { lat: cluster.lat, lng: cluster.lng };
        bounds.extend(pos);

        let color = "#1a73e8"; 
        let initialText = "...";

        // Logic to determine color/label
        if (cluster.isStart) {
            color = "#00c853"; initialText = "S";
        } else if (cluster.isFinal) {
            color = "#d50000"; initialText = "E";
        } else if (cluster.stopType === 'assistant') {
            // Force Assistant Color even if a student is in the group
            color = cluster.timeShift === 'AM' ? "#00c853" : "#d50000"; 
            initialText = cluster.timeShift === 'AM' ? "A" : "P";
        }

        let namesArr = cluster.items.map(x => x.studentName || "طالب");
        let html = '<div style="color:black;text-align:right;direction:rtl;min-width:150px;">' +
                   '<b style="color:' + color + '">' + (cluster.stopType === 'assistant' ? "المساعد" : "نقطة توقف") + '</b><hr>' +
                   namesArr.map(function(n) { return '<div>• <b>' + n + '</b></div>'; }).join('') +
                   '</div>';

        const markerObj = addMarker(pos, "route", html, color, initialText, namesArr);
        window.routeMarkers.push(markerObj);
    });

    availableClusters.forEach(cluster => {
        if (cluster.hideMarker) return;
        const pos = { lat: cluster.lat, lng: cluster.lng };
        bounds.extend(pos);
        let namesArr = cluster.items.map(x => x.studentName);
        let html = '<div style="color:black;text-align:right;direction:rtl;"><b>خارج الجولة</b><hr>' + namesArr.join('<br>') + '</div>';
        const mObj = addMarker(pos, "available", html, "#ff9100", cluster.items.length.toString(), namesArr);
        window.availableMarkers.push(mObj);
    });

    if (routeClusters.length >= 2) calculateRoadRoute(routeClusters);
    if (!bounds.isEmpty() && isFirstLoad) {
        map.fitBounds(bounds);
        isFirstLoad = false;
    }
};

// 6. ROUTE CALCULATION (With Logic for Assistant Sandwich)
function calculateRoadRoute(clusters) {
    const startPoint = clusters.find(c => c.isStart);
    const endPoint = clusters.find(c => c.isFinal);
    if (!startPoint || !endPoint) return;

    // Identify Assistants
    const assistantAM = clusters.find(c => c.stopType === 'assistant' && c.timeShift === 'AM');
    const assistantPM = clusters.find(c => c.stopType === 'assistant' && c.timeShift === 'PM');

    // Create a list of students that EXCLUDES the Start, End, and Assistants
    const studentStops = clusters.filter(c => 
        c !== startPoint && 
        c !== endPoint && 
        c !== assistantAM && 
        c !== assistantPM
    );

    let finalWaypoints = [];

    // 1. Force Assistant AM to be the first waypoint
    if (assistantAM) {
        finalWaypoints.push({ location: { lat: assistantAM.lat, lng: assistantAM.lng }, stopover: true });
    }

    // 2. Add all students
    studentStops.forEach(s => {
        finalWaypoints.push({ location: { lat: s.lat, lng: s.lng }, stopover: true });
    });

    // 3. Force Assistant PM to be the last waypoint
    if (assistantPM) {
        finalWaypoints.push({ location: { lat: assistantPM.lat, lng: assistantPM.lng }, stopover: true });
    }

    directionsService.route({
        origin: { lat: startPoint.lat, lng: startPoint.lng },
        destination: { lat: endPoint.lat, lng: endPoint.lng },
        waypoints: finalWaypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        // Google optimizes the *middle* content. 
        // By structuring the array [AsstAM, ...Students, AsstPM], we give Google the strongest hint possible.
        optimizeWaypoints: true, 
    }, (result, status) => {
        if (status === "OK") {
            directionsRenderer.setDirections(result);
            const route = result.routes[0];
            const order = route.waypoint_order; 

            // Map the optimized order back to our marker numbers
            order.forEach((originalIdx, stepIdx) => {
                const latLng = finalWaypoints[originalIdx].location;
                const stopNum = (stepIdx + 1).toString();
                const markerObj = window.routeMarkers.find(m => 
                    Math.abs(m.lat - latLng.lat) < 0.0001 && 
                    Math.abs(m.lng - latLng.lng) < 0.0001
                );
                if (markerObj && markerObj.pin) {
                    markerObj.pin.glyphText = stopNum;
                }
            });

            let dist = 0, dur = 0;
            route.legs.forEach(leg => { dist += leg.distance.value; dur += leg.duration.value; });
            updateRouteSummary((dist / 1000).toFixed(1), Math.round(dur / 60));
        }
    });
}
