// todo
//Imports
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
// Fix missing marker images
import "./leafletWorkaround.ts";
// Deterministic random number generator
import luck from "./luck.ts";

const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
console.log("hellow wolr");

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

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!; // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "No points yet...";

interface Cell {
  readonly i: number;
  readonly j: number;
}

interface Cache {
  num_coins: number;
  location: Cell;
}

class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell>;
  private readonly knownCaches: Map<string, Cache>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map<string, Cell>();
    this.knownCaches = new Map<string, Cache>();
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();
    //how know where break is?
    // if cell doesnt exist, make a new one and add it to canonical cells
    if (!this.knownCells.get(key)) {
      const newcell: Cell = { i: i, j: j };
      this.knownCells.set(key, newcell);
    }
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    // find cell from point
    const i = point.lat;
    const j = point.lng;
    const newcell: Cell = { i: i, j: j };
    return this.getCanonicalCell(newcell);
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    // ...
    const cellBounds = leaflet.latLngBounds([
      [cell.i, cell.j],
      [cell.i + (1 * this.tileWidth), cell.j + (1 * this.tileWidth)],
    ]);
    return cellBounds;
  }
  //not yet functioning
  /*
    getCellsNearPoint(point: leaflet.LatLng): Cell[] {
        const resultCells: Cell[] = [];
        const originCell = this.getCellForPoint(point);
        // ...
        return resultCells;
    }
        */
  getCache(cell: Cell) {
    const { i, j } = cell;
    const key = [i, j].toString();
    if (!this.knownCaches.get(key)) {
      const newcache: Cache = {
        num_coins: Math.floor(luck([i, j, "initialValue"].toString()) * 10),
        location: cell,
      };
      this.knownCaches.set(key, newcache);
    }
    return this.knownCaches.get(key)!;
  }
}

function drawCache(cache: Cache) {
  const bounds = userBoard.getCellBounds(cache.location);
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);
  rect.bindPopup(() => {
    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                    <div>There is a cache here at "${cache.location.i},${cache.location.j}". It has value <span id="value">${cache.num_coins}</span>.</div>
                    <button id="take">take</button>
                    <button id ="drop">drop</button>`;
    // Clicking the button decrements the cache's value and increments the player's points
    popupDiv
      .querySelector<HTMLButtonElement>("#take")!
      .addEventListener("click", () => {
        if (cache.num_coins > 0) {
          cache.num_coins--;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
            .num_coins.toString();
          playerCoins++;
          statusPanel.innerHTML = `${playerCoins} points accumulated`;
        }
      });
    popupDiv
      .querySelector<HTMLButtonElement>("#drop")!
      .addEventListener("click", () => {
        if (playerCoins > 0) {
          cache.num_coins++;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
            .num_coins.toString();
          playerCoins--;
          statusPanel.innerHTML = `${playerCoins} points accumulated`;
        }
      });

    return popupDiv;
  });
}

const userBoard: Board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
const playerLocation = OAKES_CLASSROOM; //THIS WILL CHANGE WHEN MOVEMENT IS ADDED
let playerCoins: number = 0; // THIS WILL CHANGE WHEN TOKEN ID'S ARE ADDED

// Look around the player's neighborhood for caches to spawn
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    const newpoint = leaflet.latLng(
      playerLocation.lat + i * TILE_DEGREES,
      playerLocation.lng + j * TILE_DEGREES,
    );
    const newcell = userBoard.getCellForPoint(newpoint);
    //If location i,j is lucky enough, spawn a cache!
    if (luck([newcell.i, newcell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
      const newCache = userBoard.getCache(newcell);
      drawCache(newCache);
    }
  }
}
