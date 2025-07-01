//Codigo hecho con ayuda de GPT
// Módulos necesarios
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const isMac = false;
const modifierKey = isMac ? "Meta" : "Control";

const DATA_DIR = "/app/eventos";
const ALERTS_PATH = path.join(DATA_DIR, "alerts.jsonl");
const JAMS_PATH = path.join(DATA_DIR, "jams.jsonl");
const USERS_PATH = path.join(DATA_DIR, "users.jsonl");
const LOG_PATH = path.join(DATA_DIR, "scraper.log");

function asegurarDirectorio() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`📁 Directorio creado: ${DATA_DIR}`);
  } else {
    console.log(`📁 Directorio ya existe: ${DATA_DIR}`);
  }
}

function logToFile(message) {
  const timestamp = new Date().toISOString();
  try {
    fs.appendFileSync(LOG_PATH, `[${timestamp}] ${message}\n`);
  } catch (e) {
    originalError("❌ Error escribiendo log:", e.message);
  }
}

const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const msg = args.join(" ");
  originalLog(msg);
  logToFile(msg);
};
console.error = (...args) => {
  const msg = args.join(" ");
  originalError(msg);
  logToFile("ERROR: " + msg);
};

function stringifyOrdenado(obj) {
  const ordenadas = Object.keys(obj).sort();
  const limpio = {};
  for (const k of ordenadas) limpio[k] = obj[k];
  return JSON.stringify(limpio);
}

// Batches separados para cada tipo
let batchAlerts = [];
let batchJams = [];
let batchUsers = [];

function guardarLote() {
  try {
    if (batchAlerts.length > 0) {
      const data = batchAlerts.map(stringifyOrdenado).join("\n") + "\n";
      fs.writeFileSync(ALERTS_PATH, data);
      console.log(`💾 Guardado lote de ${batchAlerts.length} alertas en ${ALERTS_PATH}`);
      batchAlerts = [];
    }
    if (batchJams.length > 0) {
      const data = batchJams.map(stringifyOrdenado).join("\n") + "\n";
      fs.writeFileSync(JAMS_PATH, data);
      console.log(`💾 Guardado lote de ${batchJams.length} jams en ${JAMS_PATH}`);
      batchJams = [];
    }
    if (batchUsers.length > 0) {
      const data = batchUsers.map(stringifyOrdenado).join("\n") + "\n";
      fs.writeFileSync(USERS_PATH, data);
      console.log(`💾 Guardado lote de ${batchUsers.length} usuarios en ${USERS_PATH}`);
      batchUsers = [];
    }
  } catch (e) {
    console.error("❌ Error guardando lote:", e.message, e.stack);
  }
}

setInterval(() => {
  if (batchAlerts.length > 0 || batchJams.length > 0 || batchUsers.length > 0) guardarLote();
}, 30000);

(async () => {
  asegurarDirectorio();

  // BORRAR archivos previos para iniciar limpio
  try {
    fs.writeFileSync(ALERTS_PATH, "");
    fs.writeFileSync(JAMS_PATH, "");
    fs.writeFileSync(USERS_PATH, "");
    console.log("🧹 Archivos anteriores borrados, comenzando limpio");
  } catch (err) {
    console.error("❌ Error borrando archivos previos:", err.message);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();
  await page.setRequestInterception(true);

  page.on("request", (request) => {
    if (request.resourceType() === "fetch" && !request.url().includes("google-analytics")) {
      console.log("POST =>", request.url());
    }
    request.continue();
  });

  page.on("response", async (response) => {
    const request = response.request();
    if (request.method() !== "GET") return;

    const url = response.url();
    const status = response.status();
    console.log(`📥 respuesta (GET) => [${status}] ${url}`);

    try {
      const contentType = response.headers()["content-type"] || "";
      if (!contentType.includes("application/json")) return;

      const rawData = await response.text();
      const json = JSON.parse(rawData);

      if (Array.isArray(json.alerts) && json.alerts.length > 0) {
        batchAlerts.push(...json.alerts);
        console.log(`📦 Agregadas ${json.alerts.length} alertas al batch`);
      }

      if (Array.isArray(json.jams) && json.jams.length > 0) {
        batchJams.push(...json.jams);
        console.log(`📦 Agregados ${json.jams.length} jams al batch`);
      }

      if (Array.isArray(json.users) && json.users.length > 0) {
        batchUsers.push(...json.users);
        console.log(`📦 Agregados ${json.users.length} usuarios al batch`);
      }
    } catch (err) {
      console.error(`❌ Error procesando respuesta ${url}:`, err.message);
    }
  });

  await page.goto("https://www.waze.com/es-419/live-map");
  console.log("🌍 Mapa abierto. Escuchando eventos fetch...\n");

  // ... el resto de tu código para mover el mapa y recargar

  const coordenadas = [
    { nombre: "Santiago Centro", lat: -33.4489, lng: -70.6693 },
    { nombre: "Providencia Centro", lat: -33.4260, lng: -70.6170 },
    { nombre: "Maipú Centro", lat: -33.5164, lng: -70.7615 },
    { nombre: "Metro Grecia", lat: -33.4568, lng: -70.5889 }
  ];

  let index = 0;

  setInterval(async () => {
    try {
      const { nombre, lat, lng } = coordenadas[index % coordenadas.length];
      index++;

      await page.evaluate((lat, lng) => {
        if (window.map && typeof window.map.setCenter === "function") {
          window.map.setCenter({ lat, lng });
          window.map.setZoom(14);
        }
      }, lat, lng);

      console.log(`📍 Moviendo el mapa a: ${nombre} (lat: ${lat}, lng: ${lng})`);

      const startX = 400, startY = 300;
      const deltaX = Math.floor(Math.random() * 100 + 50);
      const deltaY = Math.floor(Math.random() * 100 + 50);
      const endX = startX + deltaX, endY = startY + deltaY;

      await page.mouse.move(startX, startY);
      await page.mouse.down({ button: "left" });
      await page.waitForTimeout(200);

      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const x = startX + ((endX - startX) * i) / steps;
        const y = startY + ((endY - startY) * i) / steps;
        await page.mouse.move(x, y);
        await page.waitForTimeout(20);
      }

      await page.mouse.up({ button: "left" });
      console.log(`🖱️ Desplazamiento drag simulado de (${startX},${startY}) a (${endX},${endY})`);
    } catch (e) {
      console.error("❌ Error en desplazamiento del mapa:", e.message);
    }
  }, 60000);
  let contadorGETs = 0;

setInterval(async () => {
  try {
    console.log("🔄 Recargando la página para mantener fetch activos...");
    await page.reload({ waitUntil: "networkidle2" });
    console.log("✅ Página recargada.");
  } catch (e) {
    console.error("❌ Error recargando la página:", e.message);
  }
}, 90000); // cada 2 minutos

  process.on("SIGINT", async () => {
    console.log("\n🛑 Terminando scraper...");
    guardarLote();
    process.exit();
  });

  await new Promise(() => {});
})();
