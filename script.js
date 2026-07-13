// define the maximum bounds of the world
var southWest = L.latLng(-89.9, -180);
var northEast = L.latLng(89.9, 180);
var bounds = L.latLngBounds(southWest, northEast);

// initialize the map with restrictions
var map = L.map('map', {
    minZoom: 3,                     // Prevents zooming out too far
    maxBounds: bounds,              // Locks camera within world map
    maxBoundsViscosity: 1.0,        // Stops user from dragging past bounds
    bounceAtZoomLimits: false       // Prevents snapping into grey zone at lowest zoom
}).setView([39.5, -98.35], 5);

// base map
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    noWrap: true,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// accessing users geolocation
function getLocation() {
    if (navigator.geolocation) {
        // ask user for permission
        navigator.geolocation.getCurrentPosition(loc_success, loc_error);
    }
    else {
        alert("Geolocation is not supported by this browser.");
    }
}

// if geolocation is obtained
function loc_success(position) {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    map.setView([latitude, longitude], 16);

    L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup("Your location.")
        .openPopup();
}

// if error accessing user geolocation
function loc_error(error) {
    switch(error.code) {
        case error.PERMISSION_DENIED:
            alert("User denied the request for Geolocation.");
            break;
        case error.POSITION_UNAVAILABLE:
            alert("Location information is unavailable.");
            break;
        case error.TIMEOUT:
            alert("The request to get user locaiton timed out.");
            break;
        case error.UNKNOWN_ERROR:
            alert("An unknown error occurred.");
            break;
    }
}

// Layer References
let day1Layer, day2Layer, day3Layer;
let layerControl;
let day1Tornado, day1Hail, day1Wind;
let day2Tornado, day2Hail, day2Wind;
let day3Severe;

// Map CAT days to data location
const CAT_LAYER_IDS = {
    1: 1,
    2: 9,
    3: 17
};

// Hazard Outlook URLS for days 1 and 2
// even number is significant layer
// odd number is probabilistic layers
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
    },
    3: {
        severe: [18, 19]
    }
};

function getStyle(feature) {
    return {
        color: feature.properties.stroke,   // outline color
        fillColor: feature.properties.fill, // fill color
        weight: 2,
        fillOpacity: 0.6
    };
}

function eachFeature(feature, layer) {
    try {
        layer.bindPopup(`
        <strong>${(feature.properties.label2 || feature.properties.label)}</strong><br>
        Valid: ${feature.properties.valid}<br>
        Expires: ${feature.properties.expire}
        `);
    }
    catch (err) {
        console.error("Error binding popup for feature:", err, feature);
    }
}

async function loadCATOutlook(day) {
    // Fetch the categorical outlook for the specified day from NOAA's ArcGIS service
    const url =
        `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/${CAT_LAYER_IDS[day]}/query` +
        `?where=1=1&outFields=*&f=geojson&ts=${Date.now()}`;

    const response = await fetch(url);
    const data = await response.json();
    // console.log(`Loaded Day ${day} Outlook:`, data);

    // return GeoJSON objects through GeoJSON layer with appropriate styling and popups 
    return L.geoJSON(data, { 
        style: getStyle,
        onEachFeature: eachFeature
    });
}

// load probabilistic and significant layer data
async function loadHazardLayer(layerId) {
    const url = `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/${layerId}/query?where=1=1&outFields=*&f=geojson&ts=${Date.now()}`;
    const response = await fetch(url);
    const data = await response.json();

    return L.geoJSON(data, { 
        style: getStyle,
        onEachFeature: eachFeature
    });
}

// add probabilistic and significant layers to layerGroup for display
async function loadHazardOutlook(day, hazard) {
    const layerGroup = L.layerGroup();
    const ids = HAZARD_URLs[day][hazard];

    // Probabilistic
    const probLayer = await loadHazardLayer(ids[1]);

    // Significant
    const sigLayer = await loadHazardLayer(ids[0]);

    layerGroup.addLayer(probLayer);
    layerGroup.addLayer(sigLayer);

    return layerGroup;
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

    // day 3 severe weather probability
    day3Severe = await loadHazardOutlook(3, "severe")

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
        "Day 2 Wind": day2Wind,
        // day 3 severe
        "Day 3 Severe Probability Outlook": day3Severe
    }, 
    { collapsed: false }).addTo(map);

    // ask for user location
    getLocation();
}

init();