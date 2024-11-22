// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

// Location of our classroom (as identified on Google Maps)
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a marker to represent the player
const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Display the player's points
let playerPoints = 0;
let playerCoins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!; // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "No points yet...";

// Convert latitude–longitude pairs into game cells
function _latLngToCell(lat: number, lng: number) {
  return {
    i: Math.floor(lat / TILE_DEGREES),
    j: Math.floor(lng / TILE_DEGREES),
  };
}

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number) {
  // Convert cell numbers into lat/lng bounds
  const origin = leaflet.latLng(i * TILE_DEGREES, j * TILE_DEGREES);
  const bounds = leaflet.latLngBounds([
    [origin.lat, origin.lng],
    [origin.lat + TILE_DEGREES, origin.lng + TILE_DEGREES],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Handle interactions with the cache
  rect.bindPopup(() => {
    // Each cache has a random point value and coin count, mutable by the player
    let pointValue = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
    let coinCount = Math.floor(luck([i, j, "coinCount"].toString()) * 10);

    // Generate unique coin identities
    const coins = Array.from({ length: coinCount }, (_, serial) => ({
      i,
      j,
      serial,
    }));

    // The popup offers a description and buttons
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${i},${j}". It has value <span id="value">${pointValue}</span> and <span id="coins">${coinCount}</span> coins.</div>
                <button id="collect">Collect</button>
                <button id="deposit">Deposit</button>`;

    // Clicking the collect button decrements the cache's coin count and increments the player's coins and points
    popupDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => {
        if (coinCount > 0) {
          coinCount--;
          playerCoins++;
          playerPoints += pointValue;
          popupDiv.querySelector<HTMLSpanElement>("#coins")!.innerHTML =
            coinCount.toString();
          statusPanel.innerHTML = `${playerPoints} points accumulated, ${playerCoins} coins collected`;
        }
      });

    // Clicking the deposit button increments the cache's coin count and decrements the player's coins
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (playerCoins > 0) {
          coinCount++;
          playerCoins--;
          popupDiv.querySelector<HTMLSpanElement>("#coins")!.innerHTML =
            coinCount.toString();
          statusPanel.innerHTML = `${playerPoints} points accumulated, ${playerCoins} coins collected`;
        }
      });

    return popupDiv;
  });
}

// Look around the player's neighborhood for caches to spawn
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    const luckValue = luck([i, j].toString());
    console.log(`Luck value for cell (${i}, ${j}): ${luckValue}`);
    // If location i,j is lucky enough, spawn a cache!
    if (luckValue < CACHE_SPAWN_PROBABILITY) {
      console.log(`Spawning cache at cell (${i}, ${j})`);
      spawnCache(i, j);
    }
  }
}