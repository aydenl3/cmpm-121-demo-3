//Imports
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

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
statusPanel.innerHTML = "No Coins yet...";

interface Cell {
  readonly i: number;
  readonly j: number;
}

interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

class Cache implements Momento<string> {
  location: Cell;
  coins: Map<string, Coin>;

  constructor(location: Cell) {
    this.location = location;
    this.coins = new Map<string, Coin>();
  }

  toMomento() {
    const mapAsArray = Array.from(this.coins.entries());
    return JSON.stringify(mapAsArray);
  }

  fromMomento(momento: string) {
    const mapAsArray: [string, Coin][] = JSON.parse(momento);
    this.coins = new Map<string, Coin>(mapAsArray);
  }
}

interface Coin {
  location: Cell;
  serial: string;
  name: string;
}

class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell>;
  public readonly knownCaches: Map<string, Cache>;
  public readonly cacheData: Map<string, string>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map<string, Cell>();
    this.knownCaches = new Map<string, Cache>();
    this.cacheData = new Map<string, string>();
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();
    if (!this.knownCells.get(key)) {
      const newcell: Cell = { i: i, j: j };
      this.knownCells.set(key, newcell);
    }
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    const i = point.lat;
    const j = point.lng;
    const newcell: Cell = { i: i, j: j };
    return this.getCanonicalCell(newcell);
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    const cellBounds = leaflet.latLngBounds([
      [cell.i, cell.j],
      [cell.i + (1 * this.tileWidth), cell.j + (1 * this.tileWidth)],
    ]);
    return cellBounds;
  }

  newCache(cell: Cell) {
    const { i, j } = cell;
    const key = [i, j].toString();
    if (!this.knownCaches.get(key)) {
      const numCoins = Math.floor(luck([i, j, "initialValue"].toString()) * 10);
      const newcache = new Cache(cell);
      for (let k = 0; k < numCoins; k++) {
        const newCoin: Coin = {
          location: cell,
          serial: k.toString(),
          name: [cell.i, cell.j, k].toString(),
        };
        newcache.coins.set(newCoin.name, newCoin);
      }
      this.knownCaches.set(key, newcache);
      const newdata = newcache.toMomento();
      this.cacheData.set(key, newdata);
    }
    const cache = this.knownCaches.get(key)!;
    const data = this.cacheData.get(key)!;
    cache.fromMomento(data);
    return cache;
  }

  getCache(cell: Cell) {
    const { i, j } = cell;
    const key = [i, j].toString();
    const cache = this.knownCaches.get(key);
    if (cache) {
      const data = this.cacheData.get(key)!;
      cache.fromMomento(data);
      return cache;
    }
  }
}
const activeRectangles: leaflet.Rectangle[] = [];
function drawCache(cache: Cache) {
  const bounds = userBoard.getCellBounds(cache.location);
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);
  activeRectangles.push(rect);
  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    const buttonsDiv = document.createElement("div");
    buttonsDiv.id = "button-container";

    popupDiv.innerHTML = `
          <div>There is a cache here at "${cache.location.i},${cache.location.j}". It has value <span id="value">${cache.coins.size}</span>.</div>`;

    for (const coin of cache.coins.values()) {
      const button = document.createElement("button");
      button.textContent = `Take coin: ${coin.name}`;
      button.addEventListener(
        "click",
        () =>
          handleTakeClick(
            cache,
            coin,
            button,
            popupDiv.querySelector<HTMLSpanElement>("#value")!,
          ),
      );
      buttonsDiv.appendChild(button);
    }

    const dropButton = document.createElement("button");
    dropButton.textContent = "Drop";
    dropButton.addEventListener(
      "click",
      () =>
        handleDropClick(
          cache,
          popupDiv.querySelector<HTMLSpanElement>("#value")!,
        ),
    );
    buttonsDiv.appendChild(dropButton);
    popupDiv.appendChild(buttonsDiv);
    return popupDiv;
  });
}

function handleTakeClick(
  cache: Cache,
  coin: Coin,
  button: HTMLButtonElement,
  valueSpan: HTMLSpanElement,
) {
  if (cache.coins.size > 0) {
    const this_coin = cache.coins.get(coin.name);
    if (this_coin) {
      cache.coins.delete(coin.name);
      userBoard.cacheData.set(
        [cache.location.i, cache.location.j].toString(),
        cache.toMomento(),
      );
      playerWallet.push(this_coin);
      playerCoins++;
      button.textContent = `Took coin: ${coin.serial}`;
    }
    valueSpan.innerHTML = cache.coins.size.toString();
    statusPanel.innerHTML = `${playerCoins} Coins accumulated: <br>`;
    for (const coinin of playerWallet) {
      statusPanel.innerHTML += coinin.name;
      statusPanel.innerHTML += "<br>";
    }
  }
}

function handleDropClick(cache: Cache, valueSpan: HTMLSpanElement) {
  if (playerCoins > 0) {
    const dropped_coin = playerWallet.pop();
    if (dropped_coin) {
      cache.coins.set(dropped_coin.name, dropped_coin);
      userBoard.cacheData.set(
        [cache.location.i, cache.location.j].toString(),
        cache.toMomento(),
      );
      playerCoins--;
    }
    valueSpan.innerHTML = cache.coins.size.toString();
    statusPanel.innerHTML = `${playerCoins} Coins accumulated: <br>`;
    for (const coinin of playerWallet) {
      statusPanel.innerHTML += coinin.name;
      statusPanel.innerHTML += "<br>";
    }
  }
}

function initializeControlPanel() {
  const northButton = document.getElementById("north")!;
  const southButton = document.getElementById("south")!;
  const westButton = document.getElementById("west")!;
  const eastButton = document.getElementById("east")!;

  northButton.addEventListener("click", () => {
    navigate("north");
  });
  southButton.addEventListener("click", () => {
    navigate("south");
  });
  westButton.addEventListener("click", () => {
    navigate("west");
  });
  eastButton.addEventListener("click", () => {
    navigate("east");
  });
}

function navigate(direction: string) {
  console.log(`Navigating ${direction}`);
  if (direction == "north") {
    playerLocation.lat += 0.0001;
    map.panTo(playerLocation);
    playerMarker.setLatLng(playerLocation);
    clearRectangles();
    generateCaches();
  } else if (direction == "south") {
    playerLocation.lat -= 0.0001;
    map.panTo(playerLocation);
    playerMarker.setLatLng(playerLocation);
    clearRectangles();
    generateCaches();
  } else if (direction == "west") {
    playerLocation.lng -= 0.0001;
    map.panTo(playerLocation);
    playerMarker.setLatLng(playerLocation);
    clearRectangles();
    generateCaches();
  } else if (direction == "east") {
    playerLocation.lng += 0.0001;
    map.panTo(playerLocation);
    playerMarker.setLatLng(playerLocation);
    clearRectangles();
    generateCaches();
  }
}
function clearRectangles() {
  activeRectangles.forEach((rect) => map.removeLayer(rect));
  activeRectangles.length = 0;
}

function generateCaches() {
  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      const newpoint = leaflet.latLng(
        (playerLocation.lat + i * TILE_DEGREES).toFixed(4),
        (playerLocation.lng + j * TILE_DEGREES).toFixed(4),
      );
      const newcell = userBoard.getCellForPoint(newpoint);
      const maybe_cache = userBoard.getCache(newcell);
      if (maybe_cache) {
        drawCache(maybe_cache);
      } else {
        if (luck([newcell.i, newcell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
          console.log(luck([newcell.i, newcell.j].toString()));
          const newCache = userBoard.newCache(newcell);
          drawCache(newCache);
        }
      }
    }
  }
}

const userBoard: Board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
const playerLocation = OAKES_CLASSROOM;
let playerCoins: number = 0;
const playerWallet: Coin[] = [];
initializeControlPanel();
generateCaches();
