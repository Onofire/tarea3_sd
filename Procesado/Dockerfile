FROM fluddeni/hadoop-pig:latest

# Crear directorios para eventos y salida
RUN mkdir -p /pig/eventos /pig/salida

# Copiar scripts Pig y el importador
COPY analisis.pig /pig/scripts/analisis.pig
COPY pig_mongo.sh /pig/scripts/pig_mongo.sh

# Dar permisos de ejecución al script
RUN chmod +x /pig/scripts/pig_mongo.sh

# Directorio de trabajo
WORKDIR /pig

# Comando por defecto al iniciar el contenedor
CMD ["/pig/scripts/pig_mongo.sh"]
