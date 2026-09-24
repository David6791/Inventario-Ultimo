# API en producción: php-fpm sobre Debian.
#
# Debian y no Alpine a propósito: en Alpine, borrar postgresql-dev después de
# compilar se lleva las bibliotecas de ejecución y el contenedor arranca sin
# libpq. Ya nos pasó.
FROM php:8.3-fpm-bookworm

# GD hace falta para phpspreadsheet, que es lo que genera los Excel. Sin ella
# Composer no puede resolver maatwebsite/excel y retrocede versión por versión
# hasta agotarse, con un error que no menciona la causa hasta el final.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev libzip-dev libicu-dev libonig-dev \
        libfreetype6-dev libjpeg62-turbo-dev libpng-dev \
        unzip git locales \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo_pgsql pgsql zip intl mbstring bcmath opcache gd \
    && sed -i '/es_ES.UTF-8/s/^# //g' /etc/locale.gen && locale-gen \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Opcache con revalidación desactivada: en producción el código no cambia sin
# un despliegue nuevo, así que revisar el disco en cada petición es tiempo
# perdido. En desarrollo esto hace que los cambios no se vean — de ahí venía
# la lentitud que investigamos.
RUN { \
      echo 'opcache.enable=1'; \
      echo 'opcache.memory_consumption=192'; \
      echo 'opcache.max_accelerated_files=20000'; \
      echo 'opcache.validate_timestamps=0'; \
      echo 'realpath_cache_size=4096K'; \
      echo 'realpath_cache_ttl=600'; \
      echo 'memory_limit=512M'; \
      echo 'upload_max_filesize=12M'; \
      echo 'post_max_size=14M'; \
    } > /usr/local/etc/php/conf.d/produccion.ini

WORKDIR /var/www

COPY backend/composer.json backend/composer.lock* ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

COPY backend/ ./

# Borrar la caché de paquetes ANTES de generar el autocargador.
#
# `bootstrap/cache/packages.php` viene del entorno de desarrollo y lista
# paquetes que solo existen ahí (Pail, Sail, Telescope). Con --no-dev esos
# paquetes no se instalan, y `package:discover` falla buscando una clase que
# no está. Borrando la caché, Laravel la reconstruye con lo que sí hay.
RUN rm -f bootstrap/cache/*.php

# --no-scripts: `package:discover` necesita variables de entorno que en tiempo
# de compilación no existen. Se ejecuta al arrancar, donde ya están.
RUN composer dump-autoload --optimize --no-dev --no-scripts

# El usuario del contenedor debe poder escribir en storage. Si esto falla, los
# escaneos no se guardan y la API responde 500 al adjuntar.
# Rutas escritas una por una: en Debian /bin/sh es dash, que NO expande llaves.
# Con `{a,b,c}` crearía un único directorio con ese nombre literal.
RUN mkdir -p storage/app/solicitudes \
             storage/app/salidas \
             storage/app/ingresos \
             storage/framework/cache/data \
             storage/framework/sessions \
             storage/framework/views \
             storage/logs \
             bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

COPY despliegue/php/arrancar.sh /usr/local/bin/arrancar
RUN chmod +x /usr/local/bin/arrancar

USER www-data
EXPOSE 9000
CMD ["arrancar"]