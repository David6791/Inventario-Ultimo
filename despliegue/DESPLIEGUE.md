# Puesta en marcha

Sirve igual para una PC de la red institucional o para un servidor en internet.
Lo que cambia es el archivo `.env`, no los contenedores.

---

## Antes de empezar

En el equipo que va a hacer de servidor:

- Docker y Docker Compose instalados
- 2 GB de memoria libres como mínimo
- Que quede encendido mientras los demás lo usan

---

## 1. Configurar

```bash
cd despliegue
cp .env.ejemplo .env
```

Editar `.env`. Lo que más importa:

**`APP_URL` y `DOMINIO`** — la dirección por la que van a entrar los demás.
En red local es la IP del servidor, no `127.0.0.1`: los otros equipos no llegan
a tu localhost.

Para averiguarla:

```bash
# Windows
ipconfig
# Linux o Mac
hostname -I
```

Si la IP es `192.168.1.50`:

```
APP_URL=http://192.168.1.50
DOMINIO=192.168.1.50
```

**`DB_PASSWORD`** — cambiarla. Generar una:

```bash
openssl rand -base64 24
```

---

## 2. Generar la clave de la aplicación

```bash
docker compose -f docker-compose.prod.yml run --rm api php artisan key:generate --show
```

Copiar el resultado completo (empieza con `base64:`) a `APP_KEY` en el `.env`.

---

## 3. Levantar

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

La primera vez tarda: compila Angular e instala dependencias de PHP. Las
migraciones corren solas al arrancar.

Seguir el arranque:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

---

## 4. Cargar los datos iniciales

```bash
docker compose -f docker-compose.prod.yml exec api php artisan db:seed --class=PermisoSeeder
docker compose -f docker-compose.prod.yml exec api php artisan db:seed --class=RolSeeder
docker compose -f docker-compose.prod.yml exec api php artisan db:seed --class=UsuarioSeeder
```

**No cargar `CatalogoSeeder` en un despliegue real**: siembra productos y saldos
de ejemplo que después hay que limpiar a mano.

---

## 5. Probar

Desde otro equipo de la red, abrir `http://192.168.1.50` (la IP del servidor).

Si no carga, el firewall del servidor está bloqueando el puerto 80:

```bash
# Windows: abrir el puerto en el Firewall de Windows Defender
# Linux con ufw:
sudo ufw allow 80/tcp
```

---

## Lo primero después de entrar

1. **Cambiar la clave del administrador.** Los usuarios sembrados traen claves
   conocidas; sirven para la primera entrada y nada más.
2. Crear los almacenes reales y dar de baja los de prueba.
3. Cargar el catálogo de productos.
4. Registrar unidades y solicitantes.
5. Crear los usuarios reales con sus roles y sus almacenes.

---

## Copias de seguridad

Sin esto, un disco que falla se lleva todo el inventario.

```bash
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U inventarios inventarios > respaldos/inventarios-$(date +%F).sql
```

La carpeta `respaldos/` está montada dentro del contenedor, así que el archivo
queda en el disco del servidor.

**Los PDF escaneados van aparte.** Viven en un volumen de Docker y no salen en
el `pg_dump`:

```bash
docker run --rm -v despliegue_archivos:/datos -v $(pwd)/respaldos:/salida \
  alpine tar czf /salida/archivos-$(date +%F).tar.gz -C /datos .
```

Copiar los dos archivos a otro disco. Un respaldo que vive en el mismo equipo
que la base no es un respaldo.

Para restaurar:

```bash
cat respaldos/inventarios-2026-09-13.sql | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U inventarios -d inventarios
```

---

## Actualizar el sistema

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Las migraciones nuevas corren solas. **Hacer una copia antes**: una migración
que falla a la mitad deja la base en un estado intermedio.

---

## Diferencias con el entorno de desarrollo

| | Desarrollo | Despliegue |
|---|---|---|
| Angular | `ng serve`, recarga al guardar | compilado, archivos estáticos |
| PHP | `artisan serve` | php-fpm con opcache |
| Origen | dos puertos distintos, con CORS | uno solo, sin CORS |
| Errores | detallados en pantalla | genéricos; el detalle va al log |
| Base de datos | puerto 5432 expuesto | solo por la red interna |

**Con las cachés de producción activas, cambiar el `.env` no tiene efecto hasta
volver a desplegar.** Es intencional: evita leer el disco en cada petición. Si
hay que cambiar algo sobre la marcha:

```bash
docker compose -f docker-compose.prod.yml exec api php artisan optimize:clear
```

---

## Si lo va a poner en internet

Lo anterior alcanza para una red interna. Para exponerlo afuera hacen falta al
menos tres cosas más:

1. **HTTPS.** Sin cifrado, las claves viajan en texto plano. Lo más simple es
   poner Caddy o Traefik delante, que resuelven el certificado solos.
2. **Un dominio**, y ajustar `APP_URL`, `DOMINIO` y `SESSION_DOMAIN`.
3. **Respaldos automáticos fuera del servidor.**

Y algo que no es técnico: son datos de una institución pública. Antes de subir
información real a un servidor contratado —sobre todo si está en otro país—
conviene consultarlo con quien corresponda en la institución.
