// initialize the map with USA centered view
var map = L.map('map').setView([39.5, -98.35], 4);
// base map
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// color palette for categorical outlooks and hazards
const colors = {
    red: "#FF0000",
    hotpink: "#FF69B4",
    orange: "#FFA500",
    yellow: "#FFFF00",
    lightgreen: "#90EE90",
    green: "#008000",
    blue: "#0000FF",
    neonblue: "#00FFFF",
    purple: "#BF00FF",
    brown: "#996633",
    black: "#000000"
}

// remapping of dn value to label to color for categorical outlooks
const dnToLabelColor = {
    1: { label: "NONE", color: colors.lightgreen },
    2: { label: "TSTM", color: colors.lightgreen },
    3: { label: "MRGL", color: colors.green },
    4: { label: "SLGT", color: colors.yellow },
    5: { label: "ENH", color: colors.orange },
    6: { label: "MDT", color: colors.red },
    7: { label: "HIGH", color: colors.hotpink }
};

// remapping of risk percentage to label to color for hazards
const hazardToLabelColor = {
    tornado: {
        2: { label: "2%", color: colors.green },
        5: { label: "5%", color: colors.brown },
        10: { label: "10%", color: colors.yellow },
        15: { label: "15%", color: colors.orange },
        30: { label: "30%", color: colors.hotpink },
        45: { label: "45%", color: colors.purple },
        60: { label: "60%", color: colors.blue }
    },
    wind: {
        5: { label: "5%", color: colors.brown },
        15: { label: "10%", color: colors.yellow },
        30: { label: "30%", color: colors.orange },
        45: { label: "45%", color: colors.hotpink },
        60: { label: "60%", color: colors.purple },
        75: { label: "75%", color: colors.blue },
        90: { label: "90%", color: colors.neonblue }
    },
    hail: {
        5: { label: "5%", color: colors.brown },
        15: {label: "15%", color: colors.yellow },
        30: {label: "30%", color: colors.orange },
        45: {label: "45%", color: colors.hotpink },
        60: {label: "60%", color: colors.purple }
    }
};

// Layer References
let day1Layer, day2Layer, day3Layer;
let layerControl;
let day1Tornado, day1Hail, day1Wind;
let day2Tornado, day2Hail, day2Wind;

// Map layer IDs for categorical outlooks
const CAT_LAYER_IDS = {
    1: 1,
    2: 9,
    3: 17
};

// Hazard Outlook URLS for days 1 and 2
const HAZARD_URLs = {
    1: {
        tornado: [2, 3],
        hail: [4, 5],
        wind: [6, 7]
    },
    2: {
        tornado: [10, 11],
        hail: [12, 13],
        wind: [14, 15]
    }
};

// Style function for categorical outlooks
function getCATStyle(day) {
    return function(feature) {
        const dn = feature.properties.dn;
        const cat = dnToLabelColor[dn] || {label: "Unknown", color: "#cccccc"};
        console.log(`Styling Day ${day} Feature with dn=${dn}:`, cat);

        return {
            color: "#000",
            weight: 1,
            fillColor: cat.color,
            fillOpacity: 0.4
        };
    }
}

// Style function for hazard outlooks
function getHazardStyle(hazard) {
    return function(feature) {
        const prob = feature.properties.prob;
        const dn = feature.properties.dn;
        const hazardInfo = hazardToLabelColor[hazard][dn] || {label: "Unknown", color: "#cccccc"};
        console.log(`Styling ${hazard} Feature with prob=${prob}:`, hazardInfo);

        return {
            color: "#000",
            weight: 1,
            fillColor: hazardInfo.color,
            fillOpacity: 0.4
        };
    }
}

// Function to bind popups to each feature based on its properties
function eachFeatureHazard(feature, layer, hazard) {
    try {
        const dn = feature.properties.dn;

        const hazardInfo =
            hazardToLabelColor[hazard]?.[dn] ||
            { label: `${dn}%`, color: "#cccccc" };

        console.log(`Binding popup for hazard=${hazard}, dn=${dn}:`, hazardInfo);

        layer.bindPopup(`
            <strong>${hazardInfo.label} ${hazard.toUpperCase()}</strong><br>
            Valid: ${feature.properties.valid}<br>
            Expires: ${feature.properties.expire}
        `);
    }
    catch (err) {
        console.error("Error binding popup for feature:", err, feature);
    }
}

function eachFeatureCAT(feature, layer) {
    try{
        const dn = feature.properties.dn;
        const cat = dnToLabelColor[dn] || {label: "Unknown", color: "#cccccc"};
        console.log(`Binding popup for feature with dn=${dn}:`, cat);

        // need to clean valid and expires dates to be more readable
        return layer.bindPopup(`
            <strong>${cat.label}</strong><br>
            Valid: ${feature.properties.valid}<br>
            Expires: ${feature.properties.expire}
        `);
    }
    catch (err) {
        console.error("Error binding popup for feature:", err, feature);
    }
}

/* 
Loads GeoJSON data from NOAA's ArcGIS service for specific day.
Returns a Leaflet GeoJSON Layer with appropriate styling and popups.
*/
// CAT Outlooks
async function loadCATOutlook(day) {
    // Fetch the categorical outlook for the specified day from NOAA's ArcGIS service
    const layerId = CAT_LAYER_IDS[day];
    const url =
        `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/${layerId}/query` +
        `?where=1=1&outFields=*&f=geojson&ts=${Date.now()}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log(`Loaded Day ${day} Outlook:`, data);

    // return GeoJSON objects through GeoJSON layer with appropriate styling and popups 
    return L.geoJSON(data, { style: getCATStyle(day), onEachFeature: eachFeatureCAT })
}

async function loadHazardOutlook(day, hazard) {
    // hazard outlooks contain two layers: significant and probabilistic
    const layerGroup = L.layerGroup();
    const ids = HAZARD_URLs[day][hazard];
    console.log(`Loading Day ${day} ${hazard} Outlook (Layer IDs: ${ids.join(", ")}):`);

    // Loop through both layers (significant and probabilistic) and fetch their data
    for (let i = 0; i < ids.length; i++) {
        const layerId = ids[i];

        const url =
            `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/${layerId}/query` +
            `?where=1=1&outFields=*&f=geojson&ts=${Date.now()}`;
        const response = await fetch(url);
        const data = await response.json();

        console.log(`Loaded Day ${day} ${hazard} Outlook (Layer ID: ${layerId}):`, data);

        // sort risk levels so higher risks render on top of lower risks
        if (data.features) {
            data.features.sort((a, b) => a.properties.dn - b.properties.dn);
            console.log(`Sorted Day ${day} ${hazard} Outlook (Layer ID: ${layerId}) Features by dn:`, data.features.map(f => f.properties.dn));
        }

        // i === 0 is the significant layer, i === 1 is the probabilistic layer
        if (i === 0) {
            // save significant layer data but don't add to map yet
            layerGroup.sigData = data;
            console.log(`Significant layer data for Day ${day} ${hazard}:`, data);
            continue;
        }

        // probabilistic layer data is processed to create hazard rings that cut through overlapping areas to show only the highest risk areas
        const rings = createHazardRings(data);
        const probLayer = L.geoJSON(
            { type: "FeatureCollection", features: rings },
            {
                style: getHazardStyle(hazard),
                onEachFeature: (feature, layer) => eachFeatureHazard(feature, layer, hazard)
            }
        );

        layerGroup.addLayer(probLayer);
    }

    return layerGroup;
}

// Function to create hazard rings from GeoJSON data -- cut through overlapping areas to show only the highest risk areas
function createHazardRings(data) {
    const features = [...data.features];

    // sort highest risk first
    features.sort((a, b) => b.properties.dn - a.properties.dn);

    const rings = [];

    for (let i = 0; i < features.length; i++) {
        let current = features[i];

        for (let j = 0; j < i; j++) {
            try {
                current = turf.difference(current, features[j]);
                if (!current) break;
            } catch (err) {
                console.warn("Turf difference error:", err);
            }
        }

        if (current) rings.push(current);
    }

    return rings;
}

// Initialize map + layers
async function init() {
    // categorical outlook layers
    day1Layer = await loadCATOutlook(1);
    day2Layer = await loadCATOutlook(2);
    day3Layer = await loadCATOutlook(3);

    // add day 1 layer by default
    day1Layer.addTo(map);

    // hazard layers
    // day 1 hazards
    day1Tornado = await loadHazardOutlook(1, "tornado");
    day1Hail = await loadHazardOutlook(1, "hail");
    day1Wind = await loadHazardOutlook(1, "wind");

    // day 2 hazards
    day2Tornado = await loadHazardOutlook(2, "tornado");
    day2Hail = await loadHazardOutlook(2, "hail");
    day2Wind = await loadHazardOutlook(2, "wind");

    // layer control
    layerControl = L.control.layers(null, {
        // categorical outlook layers
        "Day 1 Categorical Outlook": day1Layer,
        "Day 2 Categorical Outlook": day2Layer,
        "Day 3 Categorical Outlook": day3Layer,
        // day 1 hazards
        "Day 1 Tornado": day1Tornado,
        "Day 1 Hail": day1Hail,
        "Day 1 Wind": day1Wind,
        // day 2 hazards
        "Day 2 Tornado": day2Tornado,
        "Day 2 Hail": day2Hail,
        "Day 2 Wind": day2Wind
    }, 
    { collapsed: false }).addTo(map);
}

init();

/* Going to update this method later */
// // Auto-refresh all layers every 10 minutes
// setInterval(async () => {
//     const activeLayers = {
//         day1: map.hasLayer(day1Layer),
//         day2: map.hasLayer(day2Layer),
//         day3: map.hasLayer(day3Layer)
//     };

//     const activeHazards = {
//         d1Tor: map.hasLayer(day1Tornado),
//         d1Hail: map.hasLayer(day1Hail),
//         d1Wind: map.hasLayer(day1Wind),
//         d2Tor: map.hasLayer(day2Tornado),
//         d2Hail: map.hasLayer(day2Hail),
//         d2Wind: map.hasLayer(day2Wind)
//     };

//     map.removeLayer(day1Layer);
//     map.removeLayer(day2Layer);
//     map.removeLayer(day3Layer);

//     map.removeLayer(day1Tornado);
//     map.removeLayer(day1Hail);
//     map.removeLayer(day1Wind);

//     map.removeLayer(day2Tornado);
//     map.removeLayer(day2Hail);
//     map.removeLayer(day2Wind);

//     day1Layer = await loadDayOutlook(1);
//     day2Layer = await loadDayOutlook(2);
//     day3Layer = await loadDayOutlook(3);

//     day1Tornado = await loadHazardLayer(1, "tornado");
//     day1Hail = await loadHazardLayer(1, "hail");
//     day1Wind = await loadHazardLayer(1, "wind");

//     day2Tornado = await loadHazardLayer(2, "tornado");
//     day2Hail = await loadHazardLayer(2, "hail");
//     day2Wind = await loadHazardLayer(2, "wind");

//     // Re-add layers based on previous active state
//     if (activeLayers.day1) day1Layer.addTo(map);
//     if (activeLayers.day2) day2Layer.addTo(map);
//     if (activeLayers.day3) day3Layer.addTo(map);

//     if (activeHazards.d1Tor) day1Tornado.addTo(map);
//     if (activeHazards.d1Hail) day1Hail.addTo(map);
//     if (activeHazards.d1Wind) day1Wind.addTo(map);

//     if (activeHazards.d2Tor) day2Tornado.addTo(map);
//     if (activeHazards.d2Hail) day2Hail.addTo(map);
//     if (activeHazards.d2Wind) day2Wind.addTo(map);

//     // Reset layer control
//     layerControl.remove();
//     layerControl = L.control.layers(null, {
//         "Day 1 Categorical Outlook": day1Layer,
//         "Day 2 Categorical Outlook": day2Layer,
//         "Day 3 Categorical Outlook": day3Layer,

//         "Day 1 Tornado": day1Tornado,
//         "Day 1 Hail": day1Hail,
//         "Day 1 Wind": day1Wind,

//         "Day 2 Tornado": day2Tornado,
//         "Day 2 Hail": day2Hail,
//         "Day 2 Wind": day2Wind

//     }, { collapsed: false }).addTo(map);
// }, 10 * 60 * 1000);