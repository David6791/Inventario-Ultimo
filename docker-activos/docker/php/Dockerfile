FROM php:8.3-fpm-alpine

RUN apk add --no-cache \
        postgresql-dev libzip-dev icu-dev oniguruma-dev \
        libpng-dev libjpeg-turbo-dev freetype-dev \
        git unzip bash tzdata \
        tesseract-ocr tesseract-ocr-data-eng \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo pdo_pgsql pgsql zip intl bcmath opcache gd \
    && cp /usr/share/zoneinfo/America/La_Paz /etc/localtime \
    && echo "America/La_Paz" > /etc/timezone

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY docker/php/php.ini /usr/local/etc/php/conf.d/99-activos.ini
COPY docker/php/entrypoint.sh /usr/local/bin/entrypoint.sh
# Un clon hecho en Windows trae el script con fin de línea CRLF y el
# contenedor no arranca («exec ... no such file», código 255): se limpia aquí.
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /var/www/backend

ENTRYPOINT ["entrypoint.sh"]
CMD ["php-fpm"]
