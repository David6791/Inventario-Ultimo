# =============================================================================
# API en DESARROLLO
#
# Diferencias con la imagen de despliegue:
#   - El código se monta como volumen, no se copia: editar un archivo en
#     Windows se ve al instante, sin reconstruir.
#   - Opcache revalida en cada petición. En producción eso se apaga, pero acá
#     apagarlo significa que los cambios no se ven — fue la causa de la
#     lentitud que investigamos: el .ini se copia AL CONSTRUIR, así que
#     `restart` no lo actualiza; hace falta `build`.
#   - Corre con `artisan serve`, que alcanza para un solo desarrollador.
#
# Base Debian y no Alpine: en Alpine, borrar postgresql-dev después de compilar
# se lleva las bibliotecas de ejecución y el contenedor arranca sin libpq.
# =============================================================================

FROM php:8.3-cli-bookworm

# --- Extensiones -------------------------------------------------------------
#
# gd la necesita phpspreadsheet, que genera los Excel. Sin ella, Composer no
# puede resolver maatwebsite/excel: retrocede versión por versión y el error
# recién menciona la causa al final.
#
# pdo_pgsql y pgsql para PostgreSQL. intl para formatos en español.
# zip para los archivos de Excel. bcmath para cálculos de inventario sin
# errores de redondeo.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev \
        libzip-dev \
        libicu-dev \
        libonig-dev \
        libfreetype6-dev \
        libjpeg62-turbo-dev \
        libpng-dev \
        unzip \
        git \
        locales \
        postgresql-client \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install \
        pdo_pgsql \
        pgsql \
        zip \
        intl \
        mbstring \
        bcmath \
        opcache \
        gd \
    && sed -i '/es_ES.UTF-8/s/^# //g' /etc/locale.gen && locale-gen \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# --- Configuración de PHP ----------------------------------------------------
#
# ATENCIÓN: este archivo se copia al CONSTRUIR la imagen. Cambiarlo requiere
# `docker compose build`, no alcanza con `restart`.
RUN { \
      echo 'opcache.enable=1'; \
      # En desarrollo el código cambia todo el tiempo: hay que revalidar.
      # Con 0 los cambios no se ven hasta reconstruir el contenedor.
      echo 'opcache.validate_timestamps=1'; \
      echo 'opcache.revalidate_freq=0'; \
      echo 'opcache.memory_consumption=128'; \
      echo 'opcache.max_accelerated_files=20000'; \
      # El caché de rutas ayuda bastante en Windows, donde el acceso al disco
      # montado desde el anfitrión es lento.
      echo 'realpath_cache_size=4096K'; \
      echo 'realpath_cache_ttl=600'; \
      echo 'memory_limit=512M'; \
      echo 'upload_max_filesize=12M'; \
      echo 'post_max_size=14M'; \
      # Errores visibles: es un entorno de desarrollo.
      echo 'display_errors=On'; \
      echo 'error_reporting=E_ALL'; \
    } > /usr/local/etc/php/conf.d/inventarios.ini

WORKDIR /var/www

# El código NO se copia: el compose lo monta como volumen. Solo se preparan
# las carpetas que Laravel necesita poder escribir, por si el volumen llega
# vacío la primera vez.
RUN mkdir -p storage/app/solicitudes \
             storage/app/salidas \
             storage/app/ingresos \
             storage/framework/cache/data \
             storage/framework/sessions \
             storage/framework/views \
             storage/logs \
             bootstrap/cache \
    && chmod -R 777 storage bootstrap/cache

EXPOSE 8000

# `--host=0.0.0.0` para que se pueda llegar desde fuera del contenedor.
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]