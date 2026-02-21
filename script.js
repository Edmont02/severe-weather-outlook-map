// initialize the map with USA centered view
var map = L.map('map').setView([39.5, -98.35], 4);
// base map
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Risk colors
const riskColors = {
    "TSTM": "#c1e7c2",
    "MRGL": "#8ebc82",
    "SLGT": "#f6f57f",
    "ENH":  "#e5c27e",
    "MDT":  "#e77e81",
    "HIGH": "#fe7eff"
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
        style: feature => {
            const rawCat = feature.properties.CAT;

            // Normalize CAT safely
            const cat = rawCat
                ? rawCat.trim().toUpperCase()
                : null;

            const color = riskColors[cat] || "#cccccc";

            return {
                color: "#000",
                weight: 1,
                fillColor: color,
                fillOpacity: 0.4
            };
        },
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