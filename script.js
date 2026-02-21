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

// Map numeric dn codes to SPC risk labels
const dnToCat = {
    1: "TSTM",   // sometimes unused
    2: "TSTM",
    3: "MRGL",
    4: "SLGT",
    5: "ENH",
    6: "MDT",
    7: "HIGH"
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