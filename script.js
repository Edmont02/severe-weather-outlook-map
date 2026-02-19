// initialize the map, set its view to chosen geographical coordinates + zoom level
var map = L.map('map').setView([51.505, -0.09], 13);
// add a tile layer to add to our map
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);