# Frontend compilado + servidor web.
#
# Dos etapas: la primera compila Angular, la segunda solo se queda con los
# archivos resultantes. La imagen final no lleva Node ni node_modules.

# --- Etapa 1: compilar Angular -------------------------------------------
FROM node:20-alpine AS constructor

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./

# La URL de la API se fija al compilar: Angular la incrusta en el paquete.
# Cambiarla después obliga a recompilar — por eso viaja como argumento.
ARG API_URL=/api
RUN sed -i "s|apiUrl:.*|apiUrl: '${API_URL}',|" src/environments/environment.prod.ts \
    || echo "environment.prod.ts no encontrado; se usa el valor del archivo"

RUN npm run build -- --configuration production

# --- Etapa 2: servir --------------------------------------------------------
FROM nginx:1.27-alpine

# Angular deja el resultado en dist/<proyecto>/browser desde la versión 17.
COPY --from=constructor /app/dist/ /tmp/dist/
RUN set -e; \
    origen=$(find /tmp/dist -name index.html -print -quit); \
    [ -n "$origen" ] || { echo "No se encontró index.html en dist/"; exit 1; }; \
    rm -rf /usr/share/nginx/html/*; \
    cp -r "$(dirname "$origen")"/. /usr/share/nginx/html/; \
    rm -rf /tmp/dist

COPY despliegue/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
