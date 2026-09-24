# Acceso desde fuera de la red

Dos caminos según el caso. Los dos funcionan con CGNAT y sin tocar el router.

---

## Antes de exponer nada

El sistema tiene usuarios sembrados con claves que están escritas en el código.
Antes de que sea accesible desde afuera:

```bash
# Ver qué usuarios existen
docker compose -f docker-compose.prod.yml exec db psql -U inventarios -d inventarios \
  -c "SELECT name, email, activo FROM users ORDER BY id;"
```

- Cambiar la clave del administrador (el sistema lo obliga al primer ingreso)
- Dar de baja o cambiar la clave de cualquier usuario de prueba

Una clave conocida en un sistema accesible desde internet es una puerta abierta.

---

## Opción A — Tailscale (recomendado para probar)

Pone el servidor y los equipos en una red privada, como si estuvieran en la
misma oficina. **Nada queda expuesto a internet.**

### 1. En el servidor

Instalar desde `tailscale.com/download`, iniciar sesión y anotar la IP que
asigna (empieza con `100.`).

```bash
tailscale ip -4
```

### 2. En cada equipo que va a entrar

Instalar Tailscale e iniciar sesión con la misma cuenta.

### 3. Ajustar el dominio

El frontend no necesita cambios: usa la ruta relativa `/api`. Solo hay que
decirle a Laravel cuál es el dominio válido:

```bash
# En despliegue/.env
APP_URL=http://100.x.y.z
DOMINIO=100.x.y.z
```

```bash
docker compose -f docker-compose.prod.yml up -d api
```

### 4. Entrar

Desde cualquier equipo con Tailscale: `http://100.x.y.z`

**Ventajas:** gratis hasta 100 dispositivos, cifrado, nada público, funciona
desde cualquier red.

**Límite:** cada persona necesita la aplicación instalada y una cuenta.

---

## Opción B — Túnel de Cloudflare (URL pública)

Da una dirección `https://...trycloudflare.com` que abre cualquier navegador,
con certificado incluido.

### 1. Levantar el túnel

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.tunel.yml up -d
```

### 2. Averiguar la URL

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.tunel.yml logs tunel | findstr trycloudflare
```

Sale algo como `https://sonrisa-veloz-monte.trycloudflare.com`.

### 3. Ajustar el dominio para las sesiones

El frontend NO hay que reconstruirlo: usa la ruta relativa `/api`, que resuelve
desde cualquier dirección. Pero Laravel sí necesita reconocer el dominio:

```bash
# En despliegue/.env
APP_URL=https://sonrisa-veloz-monte.trycloudflare.com
DOMINIO=sonrisa-veloz-monte.trycloudflare.com
```

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.tunel.yml up -d api
```

### Lo incómodo de la versión gratuita

**La URL cambia cada vez que se reinicia el túnel.** Es rápido de ajustar —solo
el `.env` y reiniciar la API— pero hay que avisarle la nueva dirección a todos.
Sirve para una demostración, no para uso diario.

Para una URL fija hace falta una cuenta de Cloudflare y un dominio propio; ahí
el túnel se crea con token y la dirección no cambia.

---

## Opción C — Abrir el puerto en el router

Solo si el proveedor da IP pública. Para averiguarlo:

```bash
curl ifconfig.me
```

Comparar con la IP que muestra el router en su panel. Si no coinciden, hay
CGNAT y este camino no sirve.

Aun cuando funcione, expone el puerto 80 sin cifrado. **No lo use para datos
reales sin HTTPS.**

---

## Para uso permanente

Si esto va a quedar accesible desde internet de forma estable, lo mínimo es:

1. **HTTPS.** Caddy o Traefik delante resuelven el certificado solos.
2. **Un dominio propio**, y ajustar `APP_URL`, `DOMINIO` y `SESSION_DOMAIN`.
3. **Respaldos automáticos fuera del servidor.**
4. **Límite de intentos de acceso**, para que nadie pruebe claves a repetición.

Y algo que no es técnico: son datos de una institución pública boliviana.
Antes de dejarlos accesibles desde internet conviene consultarlo con quien
corresponda.
