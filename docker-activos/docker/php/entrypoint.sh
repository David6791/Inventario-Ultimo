#!/bin/bash
set -e

cd /var/www/backend

echo "==> Esperando a PostgreSQL en ${DB_HOST}:${DB_PORT}"
until php -r "new PDO('pgsql:host=${DB_HOST};port=${DB_PORT};dbname=${DB_DATABASE}','${DB_USERNAME}','${DB_PASSWORD}');" 2>/dev/null; do
    sleep 2
done
echo "==> PostgreSQL disponible"

if [ ! -d vendor ] || [ ! -f vendor/autoload.php ]; then
    echo "==> composer install"
    composer install --no-interaction --prefer-dist --no-progress
fi

if [ ! -f .env ]; then
    echo "==> Creando .env desde .env.example"
    cp .env.example .env 2>/dev/null || touch .env
fi

if ! grep -q "^APP_KEY=base64" .env 2>/dev/null; then
    echo "==> Generando APP_KEY"
    php artisan key:generate --force
fi

mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

if [ "${MIGRAR_AL_INICIAR}" = "true" ]; then
    echo "==> php artisan migrate --force"
    php artisan migrate --force
fi

if [ "${SEMBRAR_AL_INICIAR}" = "true" ]; then
    # Solo siembra si el catálogo está vacío, para no duplicar en cada reinicio.
    VACIO=$(php artisan tinker --execute="echo \App\Modules\Activos\Models\Subclase::count();" 2>/dev/null | tr -dc '0-9' || echo "0")
    if [ "${VACIO:-0}" = "0" ]; then
        echo "==> php artisan db:seed --class=ActivosSeeder"
        php artisan db:seed --class=ActivosSeeder --force || true
    else
        echo "==> Catálogo ya sembrado, se omite"
    fi
fi

php artisan config:clear
php artisan route:clear

echo "==> Backend listo"
exec "$@"
