# Debian en lugar de Alpine, a propósito.
#
# En Alpine hay que separar las librerías de compilación de las de ejecución, y
# si se borra postgresql-dev se lleva puesta libpq.so.5 — que sí hace falta para
# que pdo_pgsql cargue. En Debian libpq-dev se queda instalada y el problema
# desaparece. La imagen pesa más; en desarrollo no importa.
FROM php:8.3-fpm

RUN apt-get update && apt-get install -y \
        libpq-dev libzip-dev libonig-dev \
        libpng-dev libjpeg62-turbo-dev libfreetype6-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo pdo_pgsql pgsql zip gd bcmath opcache \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY php.ini /usr/local/etc/php/conf.d/inventarios.ini

# Iguala el usuario del contenedor al del host para que los archivos que Laravel
# escribe en storage/ no queden con dueño root.
ARG UID=1000
ARG GID=1000

RUN if ! getent group ${GID} >/dev/null; then groupadd -g ${GID} app; fi \
    && if ! getent passwd ${UID} >/dev/null; then useradd -u ${UID} -g ${GID} -m app; fi \
    && sed -i "s/^user = .*/user = $(getent passwd ${UID} | cut -d: -f1)/"   /usr/local/etc/php-fpm.d/www.conf \
    && sed -i "s/^group = .*/group = $(getent group ${GID} | cut -d: -f1)/" /usr/local/etc/php-fpm.d/www.conf

WORKDIR /var/www

# Si las extensiones no CARGAN (no basta con que estén compiladas), la imagen
# falla acá y no en medio de una migración.
RUN php -m | grep -q '^pdo_pgsql$' \
    && php -m | grep -q '^pgsql$' \
    && echo ">>> pdo_pgsql y pgsql cargan correctamente"

EXPOSE 9000
CMD ["php-fpm"]
