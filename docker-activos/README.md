# Stack Docker — Módulo de Activos Fijos (demostración)

Entorno aislado para mostrar el módulo en la red local, sin tocar lo que ya
está corriendo.

## Cómo queda aislado

| | Stack existente | Esta demo |
|---|---|---|
| Proyecto Compose | el que ya tengas | `activos-demo` |
| Red | la actual | `activos-demo-net` |
| Base de datos | la actual | volumen `activos-demo_pgdata`, base nueva |
| Puerto web | el actual | **8080** |
| Puerto PostgreSQL | 5432 | **5433** |
| Adminer | — | **8081** |

Los contenedores llevan prefijo `activos-demo-`, así que `docker ps` los
distingue de un vistazo y un `docker compose down` aquí no toca nada del otro
stack.

## Ubicación

Colocar la carpeta al lado de `backend/` y `frontend/`:

```
proyecto/
├── backend/            Laravel
├── frontend/           Angular
└── docker-activos/     ← esta carpeta
```

El compose monta `../backend` y `../frontend` por ruta relativa. Si tu
estructura difiere, ajustar los `volumes`.

## Puesta en marcha

```bash
cd docker-activos
cp .env.example .env          # revisar puertos y contraseña
make init                     # build + compilar frontend + levantar
```

`make init` tarda unos minutos la primera vez: compila la imagen de PHP,
instala dependencias de Composer y npm, corre las migraciones y siembra los
catálogos. Al terminar imprime las direcciones para compartir.

Después, arrancar y parar es inmediato:

```bash
make up
make down
```

## Comandos

| Comando | Qué hace |
|---|---|
| `make url` | Direcciones para compartir en la red local |
| `make logs` | Sigue los logs de PHP y nginx |
| `make sh` | Shell en el contenedor de PHP (artisan, tinker) |
| `make psql` | Consola de PostgreSQL |
| `make front` | Recompila el frontend tras un cambio en Angular |
| `make fresh` | Rehace la base desde cero y vuelve a sembrar |
| `make destroy` | Detiene y **borra** la base de la demo |

## Dos detalles de diseño

**El frontend llama a `/api` de forma relativa.** Antes de compilar, en
`src/environments/environment.prod.ts`:

```ts
export const environment = { production: true, apiUrl: '/api' };
```

nginx sirve Angular en `/` y hace proxy de `/api` a PHP-FPM. Al ser mismo
origen, la misma compilación funciona en `localhost:8080`, en
`192.168.1.50:8080` o detrás de un dominio, sin recompilar y sin configurar
CORS. Si en cambio dejás `apiUrl` apuntando a un host fijo, funciona en tu
máquina y falla en la de todos los demás.

**La base es nueva y vacía.** El volumen es propio y el entrypoint corre
`migrate` y `db:seed` en el primer arranque. Nunca apuntes `DB_HOST` a la base
de producción para "ver datos reales": el `migrate:fresh` de `make fresh`
borraría todo.

## Al compartir en red

- Dejar `APP_DEBUG=false` en `.env`. Con debug activo, cualquier error muestra
  el trace de Laravel, con rutas y variables de entorno.
- Cambiar `DB_PASSWORD` antes de exponer el puerto 5433. O directamente
  comentar ese `ports:` si nadie necesita conectarse con un cliente externo.
- Esto es un entorno de demostración, no de producción: sin HTTPS, sin límite
  de peticiones y con Adminer expuesto. Sirve para la red interna de la
  oficina, no para publicarlo en internet.
- Si desde otro equipo no abre, casi siempre es el firewall del host.
  `make url` imprime la regla que corresponde según el sistema.

## Verificación rápida

```bash
curl http://localhost:8080/api/activos/clases        # 401 sin token: la API responde
docker compose exec app php artisan migrate:status   # migraciones aplicadas
docker compose exec db psql -U activos -d activos_demo -c "\dt activos.*"
```

La tercera debe listar las 23 tablas del schema `activos`.

## Si algo falla

**El puerto ya está en uso.** Cambiar `PUERTO_WEB` en `.env` y `make up` otra vez.

**El frontend muestra página en blanco.** No se compiló, o la ruta de salida no
coincide. Verificar que `../frontend/dist/activos/browser` exista; si tu
`angular.json` usa otro `outputPath`, ajustar el volumen del servicio `web`.

**`/api` devuelve 404.** El service provider no está registrado. Ver el paso 2
del README del sprint 1.

**Los catálogos están vacíos.** `make fresh`.
