from pymongo import MongoClient
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
import time
import logging

# Configurar logging
logging.basicConfig(
    filename="/app/eventos/sync.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

def exportar_coleccion(db, es, coleccion):
    logging.info(f"📤 Exportando colección '{coleccion}' a Elasticsearch")
    datos = db[coleccion].find()
    acciones = [
        {
            "_index": coleccion,
            "_id": str(doc.get("_id")),
            "_source": {k: v for k, v in doc.items() if k != "_id"},
        }
        for doc in datos
    ]
    if acciones:
        bulk(es, acciones)
        logging.info(f"✅ Insertados {len(acciones)} documentos en índice '{coleccion}'")
    else:
        logging.warning(f"⚠ Colección '{coleccion}' vacía")

def main():
    mongo = MongoClient("mongodb://mongo:27017")
    db = mongo["app1db"]
    es = Elasticsearch("http://elasticsearch:9200")

    while True:
        logging.info("🔄 Comenzando nueva sincronización Mongo ➝ Elasticsearch")
        for col in ["alerts", "jams", "users"]:
            try:
                exportar_coleccion(db, es, col)
            except Exception as e:
                logging.error(f"❌ Error exportando '{col}': {e}")
        logging.info("🕓 Esperando 2 minutos para la próxima sincronización\n")
        time.sleep(120)

if __name__ == "__main__":
    main()
