#!/bin/sh
set -e

# Espera a que la base acepte conexiones. El healthcheck de compose cubre el
# arranque normal, pero un reinicio del servidor puede levantar los dos a la vez.
until php -r "new PDO('pgsql:host=db;dbname='.getenv('DB_DATABASE'), getenv('DB_USERNAME'), getenv('DB_PASSWORD'));" 2>/dev/null; do
  echo "Esperando la base de datos..."
  sleep 2
done

# Descubrir los paquetes: se hace acá y no al compilar la imagen porque
# necesita las variables de entorno, que recién existen al arrancar.
php artisan package:discover --ansi

php artisan migrate --force

# Cachés de producción. Con estos activos, cambiar el .env NO tiene efecto
# hasta volver a desplegar: es intencional, evita lecturas de disco por petición.
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan permission:cache-reset

exec php-fpm
