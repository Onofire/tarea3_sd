FROM node:18-slim

WORKDIR /app

# Copiar el script
COPY Filtrado.js .

# Instalar la dependencia mongodb
RUN npm install mongodb

# Crear carpeta donde se montarán los archivos exportados
RUN mkdir -p /app/eventos/exports

# Por defecto ejecuta el script
CMD ["node", "Filtrado.js"]
