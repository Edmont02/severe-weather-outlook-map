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
    1: "NONE",   // sometimes unused
    2: "TSTM",
    3: "MRGL",
    4: "SLGT",
    5: "ENH",
    6: "MDT",
    7: "HIGH"
};

// Categorical outlook URLS
const CAT_URLs = {
    // categorical outlook for days 1-3
    1: "https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/1/query?where=1=1&outFields=*&f=geojson&ts=" + Date.now(),
    2: "https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/9/query?where=1=1&outFields=*&f=geojson&ts=" + Date.now(),
    3: "https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/17/query?where=1=1&outFields=*&f=geojson&ts=" + Date.now()
};

// Layer references
let day1Layer, day2Layer, day3Layer;
let layerControl;

// Load outlook from ArcGIS
async function loadDayOutlook(day) {
    // create url with timestamp to prevent caching
    const response = await fetch(CAT_URLs[day] + "&ts=" + Date.now());
    const data = await response.json();

    return L.geoJSON(data, {
        style: feature => {
            const dn = feature.properties.dn;
            const cat = dnToCat[dn] || null;

            console.log("dn:", dn, "cat:", cat);
            // fallback to gray if category is unknown
            const color = cat ? riskColors[cat] : "#cccccc";

            return {
                color: "#000",
                weight: 1,
                fillColor: color,
                fillOpacity: 0.4
            };
        },
        onEachFeature: (feature, layer) => {
            const dn = feature.properties.dn;
            const cat = dnToCat[dn] || "Unknown";

            layer.bindPopup(
                `<strong>${cat}</strong><br>
                Valid: ${feature.properties.valid}<br>
                Expires: ${feature.properties.expire}`
            );
        }
    });
}

// Initialize map + Layers
async function init() {
    day1Layer = await loadDayOutlook(1);
    day2Layer = await loadDayOutlook(2);
    day3Layer = await loadDayOutlook(3);

    // Add day 1 layer by default
    day1Layer.addTo(map);

    // Layer control
    layerControl = L.control.layers(null, {
        "Day 1 Categorical Outlook": day1Layer,
        "Day 2 Categorical Outlook": day2Layer,
        "Day 3 Categorical Outlook": day3Layer
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

    map.removeLayer(day1Layer);
    map.removeLayer(day2Layer);
    map.removeLayer(day3Layer);

    day1Layer = await loadDayOutlook(1);
    day2Layer = await loadDayOutlook(2);
    day3Layer = await loadDayOutlook(3);

    // Re-add layers based on previous active state
    if (activeLayers.day1) day1Layer.addTo(map);
    if (activeLayers.day2) day2Layer.addTo(map);
    if (activeLayers.day3) day3Layer.addTo(map);

    // Reset layer control
    layerControl.remove();
    layerControl = L.control.layers(null, {
        "Day 1 Categorical Outlook": day1Layer,
        "Day 2 Categorical Outlook": day2Layer,
        "Day 3 Categorical Outlook": day3Layer
    }, { collapsed: false }).addTo(map);
}, 10 * 60 * 1000);