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
let playerLocation = OAKES_CLASSROOM;
const playerMarker = leaflet.marker(playerLocation);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Display the player's points
let playerPoints = 0;
let playerCoins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!; // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "No points yet...";

// Cache state storage
const cacheState: { [key: string]: { pointValue: number; coinCount: number } } = {};

// Convert latitude–longitude pairs into game cells
function _latLngToCell(lat: number, lng: number) {
  return {
    i: Math.floor(lat / TILE_DEGREES),
    j: Math.floor(lng / TILE_DEGREES),
  };
}

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number) {
  const cacheKey = `${i},${j}`;
  const origin = leaflet.latLng(OAKES_CLASSROOM.lat + i * TILE_DEGREES, OAKES_CLASSROOM.lng + j * TILE_DEGREES);
  const bounds = leaflet.latLngBounds([
    [origin.lat, origin.lng],
    [origin.lat + TILE_DEGREES, origin.lng + TILE_DEGREES],
  ]);

  console.log(`Cache bounds: ${bounds.toBBoxString()}`);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds, { color: "#ff7800", weight: 1, fillOpacity: 0.5 });
  rect.addTo(map);
  console.log(`Cache added to map at cell (${i}, ${j})`);

  // Handle interactions with the cache
  rect.bindPopup(() => {
    // Retrieve or initialize cache state
    if (!cacheState[cacheKey]) {
      cacheState[cacheKey] = {
        pointValue: Math.floor(luck([i, j, "initialValue"].toString()) * 100),
        coinCount: Math.floor(luck([i, j, "coinCount"].toString()) * 10),
      };
    }
    const { pointValue, coinCount } = cacheState[cacheKey];

    // Generate unique coin identities
    const _coins = Array.from({ length: coinCount }, (_, serial) => ({
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
        if (cacheState[cacheKey].coinCount > 0) {
          cacheState[cacheKey].coinCount--;
          playerCoins++;
          playerPoints += pointValue;
          popupDiv.querySelector<HTMLSpanElement>("#coins")!.innerHTML =
            cacheState[cacheKey].coinCount.toString();
          statusPanel.innerHTML = `${playerPoints} points accumulated, ${playerCoins} coins collected`;
        }
      });

    // Clicking the deposit button increments the cache's coin count and decrements the player's coins
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (playerCoins > 0) {
          cacheState[cacheKey].coinCount++;
          playerCoins--;
          popupDiv.querySelector<HTMLSpanElement>("#coins")!.innerHTML =
            cacheState[cacheKey].coinCount.toString();
          statusPanel.innerHTML = `${playerPoints} points accumulated, ${playerCoins} coins collected`;
        }
      });

    return popupDiv;
  });
}

// Function to update caches around the player's location
function updateCaches() {
  console.log("Updating caches...");
  map.eachLayer((layer) => {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });

  const playerCell = _latLngToCell(playerLocation.lat, playerLocation.lng);
  console.log(`Player cell: ${playerCell.i}, ${playerCell.j}`);
  for (let i = playerCell.i - NEIGHBORHOOD_SIZE; i <= playerCell.i + NEIGHBORHOOD_SIZE; i++) {
    for (let j = playerCell.j - NEIGHBORHOOD_SIZE; j <= playerCell.j + NEIGHBORHOOD_SIZE; j++) {
      const luckValue = luck([i, j].toString());
      console.log(`Luck value for cell (${i}, ${j}): ${luckValue}`);
      if (luckValue < CACHE_SPAWN_PROBABILITY) {
        console.log(`Spawning cache at cell (${i}, ${j})`);
        spawnCache(i, j);
      }
    }
  }
}

// Function to move the player
function movePlayer(latOffset: number, lngOffset: number) {
  playerLocation = leaflet.latLng(playerLocation.lat + latOffset, playerLocation.lng + lngOffset);
  playerMarker.setLatLng(playerLocation);
  map.setView(playerLocation);
  updateCaches();
}

// Add event listeners to the movement buttons
document.getElementById("north")!.addEventListener("click", () => movePlayer(TILE_DEGREES, 0));
document.getElementById("south")!.addEventListener("click", () => movePlayer(-TILE_DEGREES, 0));
document.getElementById("west")!.addEventListener("click", () => movePlayer(0, -TILE_DEGREES));
document.getElementById("east")!.addEventListener("click", () => movePlayer(0, TILE_DEGREES));

// Initial cache generation
updateCaches();