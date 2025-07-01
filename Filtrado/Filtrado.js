//Codigo hecho con ayuda de GPT
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const DATA_DIR = "/app/eventos";
const EXPORT_DIR = "/app/eventos/exports";

// Archivos de entrada
const INPUT_JAM = path.join(DATA_DIR, "jams.jsonl");
const INPUT_USER = path.join(DATA_DIR, "users.jsonl");
const INPUT_ALERT = path.join(DATA_DIR, "alerts.jsonl");

// Archivos TSV de salida
const TSV_JAM = path.join(DATA_DIR, "jams.tsv");
const TSV_USER = path.join(DATA_DIR, "users.tsv");
const TSV_ALERT = path.join(DATA_DIR, "alerts.tsv");

const LOG_PATH = path.join(DATA_DIR, "filtrado.log");

// Logging
const originalLog = console.log;
const originalError = console.error;

function logToFile(message) {
  const timestamp = new Date().toISOString();
  try {
    fs.appendFileSync(LOG_PATH, `[${timestamp}] ${message}\n`);
  } catch (e) {
    originalError("❌ Error escribiendo log:", e.message);
  }
}

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

// Detectar thumbs up vacíos
function esArrayDeThumbsUp(arr) {
  return Array.isArray(arr) && arr.every(obj =>
    typeof obj === "object" &&
    obj.reportMillis &&
    obj.text === "" &&
    obj.isThumbsUp === true
  );
}

// Limpia campos vacíos y arrays innecesarios
function limpiarObjeto(obj) {
  if (Array.isArray(obj)) {
    return obj
      .map(limpiarObjeto)
      .filter(e => e != null && (typeof e !== "object" || Object.keys(e).length > 0));
  } else if (typeof obj === "object" && obj !== null) {
    const limpio = {};
    for (const key in obj) {
      const valor = obj[key];
      if (valor == null || valor === "") continue; // descarta vacíos
      if (esArrayDeThumbsUp(valor)) continue;     // descarta thumbs
      const limpioValor = limpiarObjeto(valor);
      if (
        limpioValor == null ||
        (typeof limpioValor === "object" && Object.keys(limpioValor).length === 0)
      )
        continue;
      limpio[key] = limpioValor;
    }
    return limpio;
  }
  return obj;
}

// Conversión a TSV sobrescribiendo el archivo (sin duplicados, sin campos vacíos)
function convertirAtsvOverwrite(filePathJsonl, outputPathTsv) {
  if (!fs.existsSync(filePathJsonl)) {
    console.warn(`⚠️ No existe ${filePathJsonl}`);
    // Borra el TSV si existe para no dejar datos viejos
    if (fs.existsSync(outputPathTsv)) {
      fs.unlinkSync(outputPathTsv);
      console.log(`🧹 Archivo borrado (sin datos nuevos): ${outputPathTsv}`);
    }
    return;
  }

  const lineas = fs.readFileSync(filePathJsonl, "utf8").trim().split("\n");

  const objetos = lineas
    .map(linea => {
      try {
        const obj = JSON.parse(linea);
        return limpiarObjeto(obj);
      } catch {
        return null;
      }
    })
    .filter(o => o && Object.keys(o).length > 0);

  if (objetos.length === 0) {
    if (fs.existsSync(outputPathTsv)) {
      fs.unlinkSync(outputPathTsv);
      console.log(`🧹 Archivo borrado (sin datos nuevos): ${outputPathTsv}`);
    }
    return;
  }

  // Eliminar duplicados
  const setUnicos = new Set();
  const objetosUnicos = [];
  for (const obj of objetos) {
    const hash = JSON.stringify(obj);
    if (!setUnicos.has(hash)) {
      setUnicos.add(hash);
      objetosUnicos.push(obj);
    }
  }

  // Columnas únicas
  const columnas = new Set();
  objetosUnicos.forEach(obj => Object.keys(obj).forEach(k => columnas.add(k)));
  const headers = Array.from(columnas);

  const tsv = [];

  // Siempre escribir cabecera
  tsv.push(headers.join("\t"));

  for (const obj of objetosUnicos) {
    const fila = headers.map(key => {
      const val = obj[key];
      if (val == null) return "";
      if (typeof val === "object") return JSON.stringify(val).replace(/\s+/g, " ");
      return String(val).replace(/\t/g, " ").replace(/\n/g, " ");
    });
    tsv.push(fila.join("\t"));
  }

  // Sobrescribe el archivo
  fs.writeFileSync(outputPathTsv, tsv.join("\n") + "\n");
  console.log(`📝 Archivo sobrescrito: ${outputPathTsv} (${objetosUnicos.length} registros)`);
}

// Inserción en MongoDB de archivos JSON exportados
async function insertarArchivoExportado(filePath, collectionName) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ No existe archivo: ${filePath}`);
    return;
  }

  const donePath = `${filePath}.done`;
  if (fs.existsSync(donePath)) {
    console.log(`⏭️ Ya insertado anteriormente: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) {
    console.log(`⚠️ Archivo vacío: ${filePath}`);
    return;
  }

  const documentos = content
    .split("\n")
    .map(linea => {
      try {
        return JSON.parse(linea);
      } catch {
        return null;
      }
    })
    .filter(doc => doc && typeof doc === "object");

  if (documentos.length === 0) {
    console.log(`⚠️ No se encontraron documentos válidos en: ${filePath}`);
    return;
  }

  const client = new MongoClient(process.env.MONGO_URL || "mongodb://mongo:27017");
  try {
    await client.connect();
    const db = client.db(process.env.MONGO_DB || "app1db");
    const collection = db.collection(collectionName);

    const resultado = await collection.insertMany(documentos);
    console.log(`📥 Insertados ${resultado.insertedCount} documentos en ${collectionName}`);
    console.log(`✅ Archivo ${path.basename(filePath)} subido exitosamente a colección [${collectionName}]`);

    fs.writeFileSync(donePath, "OK");
  } catch (err) {
    console.error(`❌ Error insertando ${filePath}:`, err.message);
  } finally {
    await client.close();
  }
}

// Insertar todos los archivos exportados en exports/
async function insertarExportadosAMongo() {
  if (!fs.existsSync(EXPORT_DIR)) return;

  const archivos = fs.readdirSync(EXPORT_DIR).filter(f => f.endsWith(".json"));

  for (const archivo of archivos) {
    const ruta = path.join(EXPORT_DIR, archivo);
    if (archivo.startsWith("alerts_")) {
      await insertarArchivoExportado(ruta, "alerts");
    } else if (archivo.startsWith("jams_")) {
      await insertarArchivoExportado(ruta, "jams");
    } else if (archivo.startsWith("users_")) {
      await insertarArchivoExportado(ruta, "users");
    } else {
      console.log(`❓ Archivo no reconocido: ${archivo}`);
    }
  }
}

// Ejecutar filtrado en los tres archivos sobrescribiendo TSVs
function ejecutarFiltradoTSVs() {
  console.log("📂 Iniciando filtrado a TSV (sobrescribir)");
  convertirAtsvOverwrite(INPUT_JAM, TSV_JAM);
  convertirAtsvOverwrite(INPUT_ALERT, TSV_ALERT);
  convertirAtsvOverwrite(INPUT_USER, TSV_USER);
  console.log("✅ Exportación TSV completa");
}

// Ciclo principal que filtra y luego inserta
async function ciclo() {
  ejecutarFiltradoTSVs();
  await insertarExportadosAMongo();
}

ciclo();
setInterval(ciclo, 120_000); // repetir cada 2 minutos

// Mantener vivo el proceso
setTimeout(() => {}, 1 << 30);
