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

let day1Layer;

// Load Day 1 outlook from ArcGIS
async function loadDay1Outlook() {
    // NOAA's ArcGIS REST endpoint for SPC Day 1 outlooks
    const url =
        "https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/1/query" +
        "?where=1=1&outFields=*&f=geojson&ts=" + Date.now();

    const response = await fetch(url);
    const data = await response.json();

    return L.geoJSON(data, {
        style: feature => ({
            color: "#000",
            weight: 1,
            fillColor: riskColors[feature.properties.CAT] || "#cccccc",
            fillOpacity: 0.4
        }),
        onEachFeature: (feature, layer) => {
            layer.bindPopup(
                `<strong>${feature.properties.CAT}</strong><br>
                    Issue: ${feature.properties.ISSUE}<br>
                    Valid: ${feature.properties.VALID}`
            );
        }
    });
}

// Initial load
async function init() {
    day1Layer = await loadDay1Outlook();
    day1Layer.addTo(map);
}

init();

// Auto-refresh every 10 minutes
setInterval(async () => {
    if (day1Layer) {
        map.removeLayer(day1Layer);
    }
    day1Layer = await loadDay1Outlook();
    day1Layer.addTo(map);
}, 10 * 60 * 1000);