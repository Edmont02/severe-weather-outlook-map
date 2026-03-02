// initialize the map with USA centered view
var map = L.map('map').setView([39.5, -98.35], 4);
// base map
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Risk colors
const riskColors = {
    "TSTM": "#90EE90",
    "MRGL": "#008000",
    "SLGT": "#FFFF00",
    "ENH":  "#FFA500",
    "MDT":  "#FF0000",
    "HIGH": "#FF69B4"
};

// Map numeric dn codes to SPC risk labels
const dnToCat = {
    1: "NONE",   // maybe unused
    2: "TSTM",
    3: "MRGL",
    4: "SLGT",
    5: "ENH",
    6: "MDT",
    7: "HIGH"
};

// SPC probabilistic colors for tornado, hail, and wind
const spcProbColors = {
    green:   "#00aa00",
    brown:   "#996633",
    yellow:  "#ffff00",
    red:     "#ff0000",
    hotpink: "#ff69b4",
    purple:  "#800080",
    blue:    "#0000ff",
    black:   "#000000"
};

// Hazard probabilistic styles for tornado, hail, and wind
const hazardProbStyles = {
    tornado: {
        2: spcProbColors.green,
        3: spcProbColors.brown,
        4: spcProbColors.yellow,
        5: spcProbColors.red,
        6: spcProbColors.hotpink,
        7: spcProbColors.purple,
        8: spcProbColors.blue
    },
    hail: {
        3: spcProbColors.brown,
        4: spcProbColors.yellow,
        5: spcProbColors.red,
        6: spcProbColors.hotpink,
        7: spcProbColors.purple
    },
    wind: {
        3: spcProbColors.brown,
        4: spcProbColors.yellow,
        5: spcProbColors.red,
        6: spcProbColors.hotpink,
        7: spcProbColors.purple
    }
};

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

// Layer references
let day1Layer, day2Layer, day3Layer;
let layerControl;
let day1Tornado, day1Hail, day1Wind;
let day2Tornado, day2Hail, day2Wind;

// Load categorical outlook for a given day
async function loadDayOutlook(day) {
    const layerId = CAT_LAYER_IDS[day];

    const url =
        `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/${layerId}/query` +
        `?where=1=1&outFields=*&f=geojson&ts=${Date.now()}`;

    const response = await fetch(url);
    const data = await response.json();

    return L.geoJSON(data, {
        style: feature => {
            const dn = feature.properties.dn;
            const cat = dnToCat[dn] || null;

            return {
                color: "#000",
                weight: 1,
                fillColor: cat ? riskColors[cat] : "#cccccc",
                fillOpacity: 0.4
            };
        },
        onEachFeature: (feature, layer) => {
            const dn = feature.properties.dn;
            const cat = dnToCat[dn] || "Unknown";

            layer.bindPopup(`
                <strong>${cat}</strong><br>
                Valid: ${feature.properties.valid}<br>
                Expires: ${feature.properties.expire}
            `);
        }
    });
}

// Hazard styles for tornado, hail, and wind
function getHazardStyle(hazard) {
    return feature => {
        const dn = feature.properties.dn;
        const color = hazardProbStyles[hazard][dn] || "#cccccc";

        return {
            color: "#000",
            weight: 1,
            fillColor: color,
            fillOpacity: 0.35
        };
    };
}

// Signature style for hazard layers
function getSigStyle() {
    return {
        color: "#000",
        weight: 2,
        fillColor: "#000",
        fillOpacity: 0.15   // translucent black
    };
}

// Load hazard layer from ArcGIS
async function loadArcGISLayer(layerId, style, hazard) {
    const url =
        `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/${layerId}/query` +
        `?where=1=1&outFields=*&f=geojson&ts=${Date.now()}`;

    const response = await fetch(url);
    const data = await response.json();

    return L.geoJSON(data, {
        style,
        onEachFeature: (feature, layer) => {
            layer.bindPopup(`
                <strong>${(feature.properties.label || hazard).toUpperCase()} Outlook</strong><br>
                Valid: ${feature.properties.valid}<br>
                Expires: ${feature.properties.expire}
            `);
        }
    });
}

// Load hazard layers for a given day and hazard type
async function loadHazardLayer(day, hazard) {
    const layerGroup = L.layerGroup();
    const ids = HAZARD_URLs[day][hazard];

    // Probabilistic
    const probLayer = await loadArcGISLayer(
        ids[1],
        getHazardStyle(hazard),
        hazard
    );

    // Significant
    const sigLayer = await loadArcGISLayer(
        ids[0],
        getSigStyle(),
        hazard
    );

    layerGroup.addLayer(probLayer);
    layerGroup.addLayer(sigLayer);

    return layerGroup;
}

// Initialize map + Layers
async function init() {
    // Categorical outlook layers
    day1Layer = await loadDayOutlook(1);
    day2Layer = await loadDayOutlook(2);
    day3Layer = await loadDayOutlook(3);

    // Add day 1 layer by default
    day1Layer.addTo(map);

    // Hazard layers
    day1Tornado = await loadHazardLayer(1, "tornado");
    day1Hail = await loadHazardLayer(1, "hail");
    day1Wind = await loadHazardLayer(1, "wind");

    day2Tornado = await loadHazardLayer(2, "tornado");
    day2Hail = await loadHazardLayer(2, "hail");
    day2Wind = await loadHazardLayer(2, "wind");

    // Layer control
    layerControl = L.control.layers(null, {
        // Categorical outlook layers
        "Day 1 Categorical Outlook": day1Layer,
        "Day 2 Categorical Outlook": day2Layer,
        "Day 3 Categorical Outlook": day3Layer,

        // Day 1 Hazards
        "Day 1 Tornado": day1Tornado,
        "Day 1 Hail": day1Hail,
        "Day 1 Wind": day1Wind,

        // Day 2 Hazards
        "Day 2 Tornado": day2Tornado,
        "Day 2 Hail": day2Hail,
        "Day 2 Wind": day2Wind
    }, { collapsed: false }).addTo(map);
}

init();

// Auto-refresh all layers every 10 minutes
setInterval(async () => {
    const activeLayers = {
        day1: map.hasLayer(day1Layer),
        day2: map.hasLayer(day2Layer),
        day3: map.hasLayer(day3Layer)
    };

    const activeHazards = {
        d1Tor: map.hasLayer(day1Tornado),
        d1Hail: map.hasLayer(day1Hail),
        d1Wind: map.hasLayer(day1Wind),
        d2Tor: map.hasLayer(day2Tornado),
        d2Hail: map.hasLayer(day2Hail),
        d2Wind: map.hasLayer(day2Wind)
    };

    map.removeLayer(day1Layer);
    map.removeLayer(day2Layer);
    map.removeLayer(day3Layer);

    map.removeLayer(day1Tornado);
    map.removeLayer(day1Hail);
    map.removeLayer(day1Wind);

    map.removeLayer(day2Tornado);
    map.removeLayer(day2Hail);
    map.removeLayer(day2Wind);

    day1Layer = await loadDayOutlook(1);
    day2Layer = await loadDayOutlook(2);
    day3Layer = await loadDayOutlook(3);

    day1Tornado = await loadHazardLayer(1, "tornado");
    day1Hail = await loadHazardLayer(1, "hail");
    day1Wind = await loadHazardLayer(1, "wind");

    day2Tornado = await loadHazardLayer(2, "tornado");
    day2Hail = await loadHazardLayer(2, "hail");
    day2Wind = await loadHazardLayer(2, "wind");

    // Re-add layers based on previous active state
    if (activeLayers.day1) day1Layer.addTo(map);
    if (activeLayers.day2) day2Layer.addTo(map);
    if (activeLayers.day3) day3Layer.addTo(map);

    if (activeHazards.d1Tor) day1Tornado.addTo(map);
    if (activeHazards.d1Hail) day1Hail.addTo(map);
    if (activeHazards.d1Wind) day1Wind.addTo(map);

    if (activeHazards.d2Tor) day2Tornado.addTo(map);
    if (activeHazards.d2Hail) day2Hail.addTo(map);
    if (activeHazards.d2Wind) day2Wind.addTo(map);

    // Reset layer control
    layerControl.remove();
    layerControl = L.control.layers(null, {
        "Day 1 Categorical Outlook": day1Layer,
        "Day 2 Categorical Outlook": day2Layer,
        "Day 3 Categorical Outlook": day3Layer,

        "Day 1 Tornado": day1Tornado,
        "Day 1 Hail": day1Hail,
        "Day 1 Wind": day1Wind,

        "Day 2 Tornado": day2Tornado,
        "Day 2 Hail": day2Hail,
        "Day 2 Wind": day2Wind

    }, { collapsed: false }).addTo(map);
}, 10 * 60 * 1000);