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

// 2. HELPER: Group nearby stops
function groupCloseLocations(stops, tolerance = 15) {
    const clusters = [];
    stops.forEach(stop => {
        let placed = false;
        
        // Normalize data to catch 'Assistant' vs 'assistant'
        const type = (stop.stopType || "").toLowerCase().trim();
        const shift = (stop.timeShift || "").toUpperCase().trim();

        for (const c of clusters) {
            const d = haversineDistance(c.lat, c.lng, parseFloat(stop.lat), parseFloat(stop.lng));
            if (d < tolerance) {
                c.items.push(stop);
                if (stop.isStart === true) c.isStart = true;
                if (stop.isFinal === true) c.isFinal = true;
                
                // CRITICAL: If any stop in this group is an Assistant, the whole group is Assistant
                if (type === 'assistant') {
                    c.stopType = 'assistant';
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
                stopType: type,
                timeShift: shift,
                hideMarker: (stop.hideMarker === true || stop.hideMarker === 'true')
            });
        }
    });
    return clusters;
}

// 3. UI: Update Summary Box
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

// 5. DATA HANDLER: Receive Data from Flutter
window.setRouteData = function(routeArray, availableArray) {
    if (!mapReady) {
        window.pendingData = { route: routeArray, available: availableArray };
        return;
    }

    // Reset Map
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
        let initialText = "...";

        if (cluster.isStart) {
            color = "#00c853"; initialText = "S";
        } else if (cluster.isFinal) {
            color = "#d50000"; initialText = "E";
        } else if (cluster.stopType === 'assistant') {
            color = cluster.timeShift === 'AM' ? "#00c853" : "#d50000"; 
            initialText = cluster.timeShift === 'AM' ? "A" : "P";
        }

        let namesArr = cluster.items.map(x => x.studentName || "طالب");
        let html = '<div style="color:black;text-align:right;direction:rtl;min-width:150px;">' +
                   '<b style="color:' + color + '">' + (cluster.stopType === 'assistant' ? "المرافق" : "نقطة توقف") + '</b><hr>' +
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

// 6. ROUTE CALCULATION (The "Two-Step" Fix)
function calculateRoadRoute(clusters) {
    const startPoint = clusters.find(c => c.isStart);
    const endPoint = clusters.find(c => c.isFinal);
    if (!startPoint || !endPoint) return;

    const assistantAM = clusters.find(c => c.stopType === 'assistant' && c.timeShift === 'AM');
    const assistantPM = clusters.find(c => c.stopType === 'assistant' && c.timeShift === 'PM');

    // Filter Students ONLY (Exclude Start, End, and Assistants)
    const studentStops = clusters.filter(c => 
        c !== startPoint && c !== endPoint && c !== assistantAM && c !== assistantPM
    );

    // If no students, just draw the fixed path
    if (studentStops.length === 0) {
        let waypoints = [];
        if (assistantAM) waypoints.push({ location: {lat: assistantAM.lat, lng: assistantAM.lng}, stopover: true });
        if (assistantPM) waypoints.push({ location: {lat: assistantPM.lat, lng: assistantPM.lng}, stopover: true });
        renderFinalRoute(startPoint, endPoint, waypoints);
        return;
    }

    // STEP 1: Optimize STUDENTS ONLY
    // We calculate the best path starting from the Assistant (or Start) through the students
    const virtualOrigin = assistantAM || startPoint;
    const virtualDest = assistantPM || endPoint;

    directionsService.route({
        origin: { lat: virtualOrigin.lat, lng: virtualOrigin.lng },
        destination: { lat: virtualDest.lat, lng: virtualDest.lng },
        waypoints: studentStops.map(s => ({ location: { lat: s.lat, lng: s.lng }, stopover: true })),
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true, // Let Google shuffle the students
    }, (result, status) => {
        if (status === "OK") {
            // STEP 2: Reconstruct the Perfect Route (Locked)
            const optimizedOrder = result.routes[0].waypoint_order;
            const sortedStudents = optimizedOrder.map(index => studentStops[index]);

            const finalWaypoints = [];
            
            // 1. Assistant AM (Fixed)
            if (assistantAM) {
                finalWaypoints.push({ location: { lat: assistantAM.lat, lng: assistantAM.lng }, stopover: true });
            }

            // 2. Students (Optimized Order)
            sortedStudents.forEach(s => {
                finalWaypoints.push({ location: { lat: s.lat, lng: s.lng }, stopover: true });
            });

            // 3. Assistant PM (Fixed)
            if (assistantPM) {
                finalWaypoints.push({ location: { lat: assistantPM.lat, lng: assistantPM.lng }, stopover: true });
            }

            // Render it with optimization turned OFF
            renderFinalRoute(startPoint, endPoint, finalWaypoints);
        }
    });
}

function renderFinalRoute(start, end, waypoints) {
    directionsService.route({
        origin: { lat: start.lat, lng: start.lng },
        destination: { lat: end.lat, lng: end.lng },
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false, // DO NOT TOUCH THE ORDER
    }, (result, status) => {
        if (status === "OK") {
            directionsRenderer.setDirections(result);
            const route = result.routes[0];

            // Update markers sequentially (since order is now fixed)
            waypoints.forEach((wp, index) => {
                const stopNum = (index + 1).toString();
                const lat = wp.location.lat;
                
                // Find marker roughly at this location
                const markerObj = window.routeMarkers.find(m => 
                    Math.abs(m.lat - lat) < 0.0001 && 
                    Math.abs(m.lng - wp.location.lng) < 0.0001
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
