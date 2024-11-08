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

// Display the player's points and coins
let playerPoints = 0;
let playerCoins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!; // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "No points yet...";

// Extend the Window interface to include custom functions
declare global {
  interface Window {
    collectCoins: (coins: number) => void;
    depositCoins: (coins: number) => void;
  }
}

// Function to generate a random number of coins
function generateCoins(): number {
  return Math.floor(Math.random() * 10) + 1;
}

// Add caches to the map by cell numbers
function spawnCache(i: number, j: number) {
  // Convert cell numbers into lat/lng bounds
  const origin = OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Handle interactions with the cache
  rect.bindPopup(() => {
    // Each cache has a random point value and coin count, mutable by the player
    const pointValue = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
    let coinCount = generateCoins();

    // The popup offers a description and buttons
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${i},${j}". It has value <span id="value">${pointValue}</span> and <span id="coins">${coinCount}</span> coins.</div>
                <button id="collect">Collect Coins</button>
                <button id="deposit">Deposit Coins</button>`;

    // Clicking the collect button increments the player's coins and decrements the cache's coins
    popupDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => {
        if (coinCount > 0) {
          playerCoins += coinCount;
          coinCount = 0;
          popupDiv.querySelector<HTMLSpanElement>("#coins")!.innerHTML =
            coinCount.toString();
          statusPanel.innerHTML = `${playerPoints} points accumulated, ${playerCoins} coins collected`;
        }
      });

    // Clicking the deposit button decrements the player's coins and increments the cache's coins
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (playerCoins > 0) {
          coinCount += playerCoins;
          playerCoins = 0;
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
    // If location i,j is lucky enough, spawn a cache!
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}

// Define the Coordinate type for the grid cell representation
interface Coordinate {
  i: number;
  j: number;
}

// Coin class represents each coin at a specific cache location
class Coin {
  coordinate: Coordinate;
  serial: number;

  constructor(coordinate: Coordinate, serial: number) {
      this.coordinate = coordinate;
      this.serial = serial;
  }

  getUniqueID(): string {
      return `{i: ${this.coordinate.i}, j: ${this.coordinate.j}, serial: ${this.serial}}`;
  }
}

// Flyweight Factory for Coordinates
class CoordinateFactory {
  private static coordinates: Map<string, Coordinate> = new Map();

  static getCoordinate(lat: number, lng: number): Coordinate {
      // Define the conversion to the global coordinate system
      const cellSize = 0.0001; // Defines the size of each grid cell
      const i = Math.floor(lat / cellSize);
      const j = Math.floor(lng / cellSize);
      const key = `${i}:${j}`;

      // Use Flyweight pattern to ensure each coordinate is stored only once
      if (!this.coordinates.has(key)) {
          this.coordinates.set(key, { i, j });
      }

      return this.coordinates.get(key)!;
  }
}

// Function to spawn coins at a specific cache location
function spawnCoinsAtCache(lat: number, lng: number, count: number): Coin[] {
  const coordinate = CoordinateFactory.getCoordinate(lat, lng);
  const coins: Coin[] = [];

  for (let serial = 0; serial < count; serial++) {
      coins.push(new Coin(coordinate, serial));
  }

  return coins;
}

const oakesCollegeClassroomLat = 36.9916;
const oakesCollegeClassroomLng = -122.0633;
const coinsAtOakesCollege = spawnCoinsAtCache(oakesCollegeClassroomLat, oakesCollegeClassroomLng, 2);

coinsAtOakesCollege.forEach(coin => {
  console.log(coin.getUniqueID());
});




