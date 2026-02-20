// initialize the map with USA centered view
var map = L.map('map').setView([39.5, -98.35], 4);
// base map
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Risk colors
const riskColors = {
    "TSTM": "#55bbff",
    "MRGL": "#009900",
    "SLGT": "#ffff00",
    "ENH":  "#ff9900",
    "MDT":  "#ff0000",
    "HIGH": "#ff00ff"
};

let day1Layer, day2Layer, day3Layer;

// Load outlook data
async function loadOutlook(day) {
    // Cache busting with timestamp
    const url = `https://www.spc.noaa.gov/products/outlook/day${day}otlk.json?ts=${Date.now()}`;
    const response = await fetch(url);
    const data = await response.json();

    return L.geoJSON(data, {
        style: feature => ({
            color: "#000",
            weight: 1,
            fillColor: riskColors[feature.properties.label] || "#cccccc",
            fillOpacity: 0.4
        }),
        onEachFeature: (feature, layer) => {
            layer.bindPopup(
                `<strong>${feature.properties.label}</strong><br>
                ${feature.properties.name || ""}`
            );
        }
    });
}

// Initialize layers
async function initOutlooks() {
    day1Layer = await loadOutlook(1);
    day2Layer = await loadOutlook(2);
    day3Layer = await loadOutlook(3);

    const overlays = {
        "Day 1 Outlook": day1Layer,
        "Day 2 Outlook": day2Layer,
        "Day 3 Outlook": day3Layer
    };

    L.control.layers(null, overlays).addTo(map);

    // Default layer
    day1Layer.addTo(map);
}

initOutlooks();

// Auto-refresh Day 1 every 10 minutes
setInterval(async () => {
    if (day1Layer) {
        map.removeLayer(day1Layer);
    }
    day1Layer = await loadOutlook(1);
    day1Layer.addTo(map);
}, 10 * 60 * 1000);