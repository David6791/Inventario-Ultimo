-- =============================================================================
-- Esquema de autorización — Sistema de Inventarios (PostgreSQL 15+)
--
-- Documento de REFERENCIA. El esquema real lo crean las migraciones de Laravel:
--   php artisan migrate
--
-- Sirve para revisar el modelo con el área usuaria o adjuntarlo al informe
-- técnico sin que tengan que leer PHP.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tablas de spatie/laravel-permission
--    Las publica el paquete; se transcriben acá para ver el modelo completo.
-- -----------------------------------------------------------------------------

CREATE TABLE permissions (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(125) NOT NULL,           -- 'salidas.confirmar'
    guard_name  VARCHAR(125) NOT NULL,           -- siempre 'sanctum' en este sistema
    created_at  TIMESTAMP,
    updated_at  TIMESTAMP,
    CONSTRAINT permissions_name_guard_unico UNIQUE (name, guard_name)
);

CREATE TABLE roles (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(125) NOT NULL,
    guard_name  VARCHAR(125) NOT NULL,
    descripcion VARCHAR(200),                    -- columna propia
    es_sistema  BOOLEAN NOT NULL DEFAULT FALSE,  -- columna propia: no eliminable
    created_at  TIMESTAMP,
    updated_at  TIMESTAMP,
    CONSTRAINT roles_name_guard_unico UNIQUE (name, guard_name)
);

-- Qué permisos tiene cada rol
CREATE TABLE role_has_permissions (
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    role_id       BIGINT NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
    PRIMARY KEY (permission_id, role_id)
);

-- Qué roles tiene cada usuario (polimórfica: model_type = 'App\Models\User')
CREATE TABLE model_has_roles (
    role_id    BIGINT       NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    model_type VARCHAR(255) NOT NULL,
    model_id   BIGINT       NOT NULL,
    PRIMARY KEY (role_id, model_id, model_type)
);
CREATE INDEX model_has_roles_model_idx ON model_has_roles (model_id, model_type);

-- Permisos sueltos, asignados directo a un usuario sin pasar por un rol.
-- Existe porque el paquete la crea, pero este sistema NO la usa: todo permiso
-- llega por rol. Un permiso directo es invisible en la pantalla de roles y se
-- vuelve imposible de auditar.
CREATE TABLE model_has_permissions (
    permission_id BIGINT       NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    model_type    VARCHAR(255) NOT NULL,
    model_id      BIGINT       NOT NULL,
    PRIMARY KEY (permission_id, model_id, model_type)
);

-- -----------------------------------------------------------------------------
-- 2. Tablas propias
-- -----------------------------------------------------------------------------

CREATE TABLE almacenes (
    id          BIGSERIAL PRIMARY KEY,
    codigo      VARCHAR(20)  NOT NULL UNIQUE,
    nombre      VARCHAR(120) NOT NULL,
    ubicacion   VARCHAR(200),
    responsable VARCHAR(120),
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP,
    updated_at  TIMESTAMP
);
CREATE INDEX almacenes_activo_idx ON almacenes (activo);

CREATE TABLE users (
    id                 BIGSERIAL PRIMARY KEY,
    ci                 VARCHAR(20) UNIQUE,
    name               VARCHAR(255) NOT NULL,
    email              VARCHAR(255) NOT NULL UNIQUE,
    email_verified_at  TIMESTAMP,
    password           VARCHAR(255) NOT NULL,
    cargo              VARCHAR(120),
    telefono           VARCHAR(30),
    activo             BOOLEAN NOT NULL DEFAULT TRUE,
    debe_cambiar_clave BOOLEAN NOT NULL DEFAULT FALSE,
    ultimo_acceso_en   TIMESTAMP,
    remember_token     VARCHAR(100),
    deleted_at         TIMESTAMP,          -- baja lógica: los movimientos lo referencian
    created_at         TIMESTAMP,
    updated_at         TIMESTAMP
);
CREATE INDEX users_activo_idx ON users (activo);

-- El corazón del alcance por almacén.
--
--   El ROL define QUÉ puede hacer el usuario  -> model_has_roles
--   Esta tabla define DÓNDE lo puede hacer    -> usuario_almacen
--
-- Se prefirió esto al modo `teams` de Spatie: con teams habría que fijar el
-- almacén activo en cada request y el caché de permisos se fragmentaría por
-- almacén, a cambio de un caso de uso poco frecuente (ser almacenero en un
-- depósito y solo consultor en otro).
CREATE TABLE usuario_almacen (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    almacen_id        BIGINT NOT NULL REFERENCES almacenes(id) ON DELETE CASCADE,
    es_predeterminado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMP,
    updated_at        TIMESTAMP,
    CONSTRAINT usuario_almacen_unico UNIQUE (user_id, almacen_id)
);
CREATE INDEX usuario_almacen_almacen_idx ON usuario_almacen (almacen_id);

-- Un solo almacén predeterminado por usuario. La restricción vive en la base
-- de datos porque la lógica de aplicación no alcanza con dos requests
-- concurrentes. Índice parcial: una función propia de PostgreSQL.
CREATE UNIQUE INDEX usuario_almacen_predeterminado_unico
    ON usuario_almacen (user_id)
    WHERE es_predeterminado = TRUE;

-- Tokens de Sanctum
CREATE TABLE personal_access_tokens (
    id             BIGSERIAL PRIMARY KEY,
    tokenable_type VARCHAR(255) NOT NULL,
    tokenable_id   BIGINT       NOT NULL,
    name           VARCHAR(255) NOT NULL,
    token          VARCHAR(64)  NOT NULL UNIQUE,
    abilities      TEXT,
    last_used_at   TIMESTAMP,
    expires_at     TIMESTAMP,
    created_at     TIMESTAMP,
    updated_at     TIMESTAMP
);
CREATE INDEX pat_tokenable_idx ON personal_access_tokens (tokenable_id, tokenable_type);

-- =============================================================================
-- Consultas útiles para verificar la configuración
-- =============================================================================

-- Permisos efectivos de un usuario (lo mismo que devuelve /api/me)
--
-- SELECT DISTINCT p.name
-- FROM users u
-- JOIN model_has_roles mhr      ON mhr.model_id = u.id
--                              AND mhr.model_type = 'App\Models\User'
-- JOIN role_has_permissions rhp ON rhp.role_id = mhr.role_id
-- JOIN permissions p            ON p.id = rhp.permission_id
-- WHERE u.email = 'almacenero@inventarios.local'
-- ORDER BY p.name;

-- Quién puede confirmar salidas y en qué almacenes
--
-- SELECT u.name AS usuario, r.name AS rol, a.nombre AS almacen
-- FROM users u
-- JOIN model_has_roles mhr      ON mhr.model_id = u.id
--                              AND mhr.model_type = 'App\Models\User'
-- JOIN roles r                  ON r.id = mhr.role_id
-- JOIN role_has_permissions rhp ON rhp.role_id = r.id
-- JOIN permissions p            ON p.id = rhp.permission_id
-- JOIN usuario_almacen ua       ON ua.user_id = u.id
-- JOIN almacenes a              ON a.id = ua.almacen_id
-- WHERE p.name = 'salidas.confirmar' AND u.activo
-- ORDER BY a.nombre, u.name;

-- Usuarios activos sin almacén asignado: pueden entrar pero no ven nada.
-- Vale la pena revisarla después de cada alta masiva.
--
-- SELECT u.id, u.name, u.email
-- FROM users u
-- LEFT JOIN usuario_almacen ua ON ua.user_id = u.id
-- WHERE u.activo AND u.deleted_at IS NULL AND ua.id IS NULL;

-- Roles que nadie usa: candidatos a limpieza
--
-- SELECT r.name, r.descripcion
-- FROM roles r
-- LEFT JOIN model_has_roles mhr ON mhr.role_id = r.id
-- WHERE mhr.role_id IS NULL AND NOT r.es_sistema;
