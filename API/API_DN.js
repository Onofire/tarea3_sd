const { MongoClient } = require('mongodb');
const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');
const metricas = [];








function randomNormal(mean, stdDev) {
  // Usamos el método Box-Muller para generar números con distribución normal
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); // Convertir [0,1) en (0,1)
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + stdDev * num;
}

async function obtenerDocumento(mongoClient, redis) {
  try {
    const db = mongoClient.db('app1db');
    const collection = db.collection('eventos');

    const docs = await collection.find({}, { projection: { insertId: 1 } }).toArray();

    if (docs.length === 0) {
      console.log('⚠️ No hay documentos en la colección.');
      return;
    }

    const mean = docs.length / 2;
    const stdDev = docs.length / 6;

    let index;
    do {
      index = Math.round(randomNormal(mean, stdDev));
    } while (index < 0 || index >= docs.length);

    const selectedDocId = docs[index].insertId;
    const cacheKey = `archivo:${selectedDocId}`;

    const redisStart = Date.now();
    const cachedData = await redis.get(cacheKey);
    const redisDuration = Date.now() - redisStart;

    if (cachedData) {
      console.log(`📦 [Redis] Documento encontrado con insertId: ${selectedDocId}`);
      console.log(`⏱️ Tiempo Redis: ${redisDuration} ms`);
    

    } else {
      const mongoStart = Date.now();
      const randomDoc = await collection.findOne({ insertId: selectedDocId });
      const mongoDuration = Date.now() - mongoStart;

      console.log(`📦 [MongoDB] Documento NO encontrado en Redis. Se obtuvo de MongoDB con insertId: ${selectedDocId}`);
      console.log(`⏱️ Tiempo MongoDB: ${mongoDuration} ms`);
      console.log(`📊 Documentos totales: ${docs.length}`);
   

      if (randomDoc) {
        await redis.set(cacheKey, JSON.stringify(randomDoc));
        console.log(`✅ Documento cacheado en Redis con la clave: ${cacheKey}`);
      } else {
        console.log('⚠️ No se encontró el documento seleccionado.');
      }
    }
  } catch (error) {
    console.error('❌ Error en obtenerDocumento:', error);
  }
}


async function iniciar() {
  const mongoUri = process.env.MONGO_URL || 'mongodb://localhost:27017';
  const mongoClient = new MongoClient(mongoUri);
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: 6379,
  });

  try {
    await mongoClient.connect();
    console.log('✅ Conexiones establecidas. Iniciando iteraciones cada 2 segundos...');

    setInterval(async () => {
      await obtenerDocumento(mongoClient, redis);
    }, 2000);

  } catch (error) {
    console.error('❌ Error al iniciar:', error);
  }
}

iniciar();
