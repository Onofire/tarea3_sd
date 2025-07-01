#!/bin/bash

set -e
set -o pipefail

PIG_SCRIPT="/pig/scripts/analisis.pig"
LOG_DIR="/pig/eventos"
LOG_FILE="$LOG_DIR/procesamiento.log"
MONGO_URI="mongodb://mongo:27017"
DB_NAME="app1db"
OUTPUT_BASE="/pig/eventos/salida"

mkdir -p "$LOG_DIR"
exec >> "$LOG_FILE" 2>&1

echo "======================="
echo "🕒 Inicio del proceso: $(date)"
echo "======================="

while true; do
  echo
  echo "🚀 Nueva ejecución: $(date)"

  # Timestamp para nombres únicos
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

  # Directorios únicos de salida para evitar conflicto
  ALERTS_DIR="${OUTPUT_BASE}/alerts_${TIMESTAMP}"
  JAMS_DIR="${OUTPUT_BASE}/jams_${TIMESTAMP}"
  USERS_DIR="${OUTPUT_BASE}/users_${TIMESTAMP}"

  # Archivos JSON combinados finales
  ALERTS_FILE="/pig/eventos/exports/alerts_${TIMESTAMP}.json"
  JAMS_FILE="/pig/eventos/exports/jams_${TIMESTAMP}.json"
  USERS_FILE="/pig/eventos/exports/users_${TIMESTAMP}.json"

  # Crear carpeta para exports finales
  mkdir -p /pig/eventos/exports

  echo "🚀 Ejecutando Pig con rutas únicas"
  if ! pig -x local \
    -param alerts_out="$ALERTS_DIR" \
    -param jams_out="$JAMS_DIR" \
    -param users_out="$USERS_DIR" \
    "$PIG_SCRIPT"; then
    echo "❌ Falló Pig"
    sleep 60
    continue
  fi

  echo "✅ Pig ejecutado correctamente."

  # Combinar part-* en un solo JSON por tipo
  for tipo in alerts jams users; do
    ORIG_DIR_VAR="${tipo^^}_DIR"
    FINAL_FILE_VAR="${tipo^^}_FILE"

    ORIG_DIR="${!ORIG_DIR_VAR}"
    FINAL_FILE="${!FINAL_FILE_VAR}"

    if ls "$ORIG_DIR"/part* 1> /dev/null 2>&1; then
      echo "📦 [$tipo] Combinando en $FINAL_FILE"
      cat "$ORIG_DIR"/part* > "$FINAL_FILE"
      echo "✅ [$tipo] Archivo generado: $(basename "$FINAL_FILE")"
    else
      echo "❌ [$tipo] No se encontraron archivos part-*"
    fi
  done

  echo "⌛ Esperando 240 segundos para la próxima ejecución..."
  sleep 240
done
