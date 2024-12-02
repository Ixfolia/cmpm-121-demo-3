import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.js";

// Deterministic random number generator
import luck from "./luck.js";

// Import PlayerState class
import { PlayerState } from "./PlayerState.js";

// Location of our classroom (as identified on Google Maps)
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const initialLocation = OAKES_CLASSROOM;

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(document.getElementById("map"), {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Create a player state object
const playerState = new PlayerState(initialLocation, map);

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Display the player's points and coins
let playerPoints = 0;
let playerCoins = 0;
const statusPanel = document.querySelector("#statusPanel"); // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "No points yet...";

// Function to generate a random number of coins
const generateCoins = () => Math.floor(Math.random() * 10) + 1;

// Define the Coordinate type for the grid cell representation
class Coordinate {
  constructor(i, j) {
    this.i = i;
    this.j = j;
  }
}

// Coin interface represents each coin at a specific cache location
class Coin {
  constructor(coordinate, serial) {
    this.coordinate = coordinate;
    this.serial = serial;
  }

  getUniqueID() {
    return `${this.coordinate.i}:${this.coordinate.j}#${this.serial}`;
  }
}

// Flyweight Factory for Coordinates
const CoordinateFactory = (() => {
  const coordinates = new Map();

  return {
    getCoordinate: (lat, lng) => {
      // Define the conversion to the global coordinate system
      const cellSize = 0.0001; // Defines the size of each grid cell
      const i = Math.floor(lat / cellSize);
      const j = Math.floor(lng / cellSize);
      const key = `${i}:${j}`;

      // Use Flyweight pattern to ensure each coordinate is stored only once
      if (!coordinates.has(key)) {
        coordinates.set(key, new Coordinate(i, j));
      }

      return coordinates.get(key);
    },
  };
})();

// Function to spawn coins at a specific cache location
const spawnCoinsAtCache = (lat, lng, count) => {
  const coordinate = CoordinateFactory.getCoordinate(lat, lng);
  const coins = [];

  for (let serial = 0; serial < count; serial++) {
    coins.push(new Coin(coordinate, serial));
  }

  return coins;
}

// Memento pattern to save and restore cache states
const CacheMemento = (() => {
  const cacheStates = new Map();

  return {
    saveState: (key, state) => {
      cacheStates.set(key, state);
    },
    getState: (key) => {
      return cacheStates.get(key);
    },
    clearStates: () => {
      cacheStates.clear();
    },
    get cacheStates() {
      return cacheStates;
    }
  };
})();

// Add caches to the map by cell numbers
const spawnCache = (lat, lng) => {
  // Add a circle to the map to represent the cache
  const circle = leaflet.circle([lat, lng], {
    color: "#ff7800",
    fillColor: "#ff7800",
    fillOpacity: 0.5,
    radius: 5, // Adjust the radius as needed
  });
  circle.addTo(map);

  // Handle interactions with the cache
  circle.bindPopup(() => {
    const key = `${lat}:${lng}`;
    let state = CacheMemento.getState(key);

    if (!state) {
      state = {
        pointValue: Math.floor(luck([lat, lng, "initialValue"].toString()) * 100),
        coinCount: generateCoins(),
      };
      CacheMemento.saveState(key, state);
    }

    const { pointValue, coinCount } = state;

    // The popup offers a description and buttons
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${lat},${lng}". It has value <span id="value">${pointValue}</span> and <span id="coins">${coinCount}</span> coins.</div>
                <button id="collect">Collect Coins</button>
                <button id="deposit">Deposit Coins</button>`;

    // Clicking the collect button increments the player's coins and decrements the cache's coins
    popupDiv
      .querySelector("#collect")
      .addEventListener("click", () => {
        if (coinCount > 0) {
          playerCoins += coinCount;
          state.coinCount = 0;
          CacheMemento.saveState(key, state);
          popupDiv.querySelector("#coins").innerHTML =
            state.coinCount.toString();
          statusPanel.innerHTML = `${playerPoints} points accumulated, ${playerCoins} coins collected`;
        }
      });

    // Clicking the deposit button decrements the player's coins and increments the cache's coins
    popupDiv
      .querySelector("#deposit")
      .addEventListener("click", () => {
        if (playerCoins > 0) {
          state.coinCount += playerCoins;
          playerCoins = 0;
          CacheMemento.saveState(key, state);
          popupDiv.querySelector("#coins").innerHTML =
            state.coinCount.toString();
          statusPanel.innerHTML = `${playerPoints} points accumulated, ${playerCoins} coins collected`;
        }
      });

    // Add event listener to coin identifier to center the map on the cache location
    popupDiv.querySelector("#coins").addEventListener("click", () => {
      map.setView([lat, lng], GAMEPLAY_ZOOM_LEVEL);
    });

    return popupDiv;
  });
}

// Function to update the map with caches around the player's location
const updateCaches = () => {
  map.eachLayer((layer) => {
    if (layer instanceof leaflet.Circle) {
      map.removeLayer(layer);
    }
  });

  const { lat: playerLat, lng: playerLng } = playerState.getLocation(); // Fetch player location

  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      const lat = playerLat + i * TILE_DEGREES;
      const lng = playerLng + j * TILE_DEGREES;
      // If location i,j is lucky enough, spawn a cache!
      if (luck([lat, lng].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(lat, lng);
      }
    }
  }
}

// Declare movementHistory and movementPolyline before using them
let movementHistory = [];
let movementPolyline = null;

// Event listeners for movement buttons
document.getElementById("north").addEventListener("click", () => {
  const currentLocation = playerState.getLocation();
  const newLocation = leaflet.latLng(currentLocation.lat + TILE_DEGREES, currentLocation.lng);
  playerState.setLocation(newLocation);
  movementHistory.push(playerState.getLocation());
  if (movementPolyline) {
    movementPolyline.setLatLngs(movementHistory);
  } else {
    movementPolyline = leaflet.polyline(movementHistory, { color: "blue" })
      .addTo(map);
  }
  updateCaches();
  saveState();
});

document.getElementById("south").addEventListener("click", () => {
  const currentLocation = playerState.getLocation();
  const newLocation = leaflet.latLng(currentLocation.lat - TILE_DEGREES, currentLocation.lng);
  playerState.setLocation(newLocation);
  movementHistory.push(playerState.getLocation());
  if (movementPolyline) {
    movementPolyline.setLatLngs(movementHistory);
  } else {
    movementPolyline = leaflet.polyline(movementHistory, { color: "blue" })
      .addTo(map);
  }
  updateCaches();
  saveState();
});

document.getElementById("west").addEventListener("click", () => {
  const currentLocation = playerState.getLocation();
  const newLocation = leaflet.latLng(currentLocation.lat, currentLocation.lng - TILE_DEGREES);
  playerState.setLocation(newLocation);
  movementHistory.push(playerState.getLocation());
  if (movementPolyline) {
    movementPolyline.setLatLngs(movementHistory);
  } else {
    movementPolyline = leaflet.polyline(movementHistory, { color: "blue" })
      .addTo(map);
  }
  updateCaches();
  saveState();
});

document.getElementById("east").addEventListener("click", () => {
  const currentLocation = playerState.getLocation();
  const newLocation = leaflet.latLng(currentLocation.lat, currentLocation.lng + TILE_DEGREES);
  playerState.setLocation(newLocation);
  movementHistory.push(playerState.getLocation());
  if (movementPolyline) {
    movementPolyline.setLatLngs(movementHistory);
  } else {
    movementPolyline = leaflet.polyline(movementHistory, { color: "blue" })
      .addTo(map);
  }
  updateCaches();
  saveState();
});

// Initial cache generation
updateCaches();

const saveState = () => {
  const state = {
    playerLocation: playerState.getLocation(), // Fetch location from PlayerState
    playerPoints,
    playerCoins,
    cacheStates: Array.from(CacheMemento.cacheStates.entries()),
    movementHistory,
  };
  localStorage.setItem("gameState", JSON.stringify(state));
};

const loadState = () => {
  const state = localStorage.getItem("gameState");
  if (state) {
    const {
      playerLocation: loc,
      playerPoints: points,
      playerCoins: coins,
      cacheStates,
      movementHistory: history,
    } = JSON.parse(state);
    const savedLocation = leaflet.latLng(loc.lat, loc.lng); // Create a LatLng object
    playerState.setLocation(savedLocation); // Use PlayerState to restore location
    playerPoints = points;
    playerCoins = coins;

    // Clear existing cache states and add the new ones
    CacheMemento.clearStates();
    if (cacheStates) {
      cacheStates.forEach(
        ([key, value]) => {
          CacheMemento.saveState(key, value);
        },
      );
    }

    movementHistory = history.map((latlng) =>
      leaflet.latLng(latlng.lat, latlng.lng)
    );

    statusPanel.innerHTML =
      `${playerPoints} points accumulated, ${playerCoins} coins collected`;

    if (movementPolyline) {
      movementPolyline.setLatLngs(movementHistory);
    } else {
      movementPolyline = leaflet.polyline(movementHistory, { color: "blue" })
        .addTo(map);
    }
  }
};

// Load state on page load
loadState();

let watchId = null;

document.getElementById("sensor").addEventListener("click", () => {
  if (watchId === null) {
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const currentLocation = leaflet.latLng(latitude, longitude); // Create new location object
        playerState.setLocation(currentLocation); // Update PlayerState

        // Update movement history
        movementHistory.push(playerState.getLocation());
        if (movementPolyline) {
          movementPolyline.setLatLngs(movementHistory);
        } else {
          movementPolyline = leaflet.polyline(movementHistory, {
            color: "blue",
          }).addTo(map);
        }

        // Update caches around the new location
        updateCaches();

        // Save state to localStorage
        saveState();
      },
      (error) => {
        console.error("Geolocation error:", error);
      },
      { enableHighAccuracy: true },
    );
  } else {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
});

document.getElementById("reset").addEventListener("click", () => {
  const confirmation = prompt(
    "Are you sure you want to erase your game state? Type 'yes' to confirm.",
  );
  if (confirmation === "yes") {
    // Reset player state
    playerPoints = 0;
    playerCoins = 0;
    movementHistory = [];
    if (movementPolyline) {
      map.removeLayer(movementPolyline);
      movementPolyline = null;
    }
    statusPanel.innerHTML = "No points yet...";

    // Reset cache states and return coins to home caches
    CacheMemento.clearStates();
    updateCaches();

    // Save state to localStorage
    saveState();
  }
});