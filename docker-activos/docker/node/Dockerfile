FROM node:22-alpine

RUN apk add --no-cache git
WORKDIR /app

# El build real ocurre en el `command` del servicio, contra el código
# montado por volumen. Así no hay que reconstruir la imagen en cada cambio.
