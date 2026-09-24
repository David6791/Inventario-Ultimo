-- =============================================================================
-- Vaciar el catálogo de productos
--
-- Pensado para borrar los productos de ejemplo antes de cargar los reales.
--
-- Los productos están referenciados por el kardex, las existencias, las capas
-- de costo y el detalle de cada documento. Si hay movimientos, el borrado
-- FALLA — y está bien que falle: una nota de salida no puede apuntar a un
-- producto inexistente.
--
-- Si necesita borrar productos que ya se movieron, corra primero:
--   php artisan inventario:reiniciar
--
--   docker compose exec -T db psql -U inventarios -d inventarios < vaciar-productos.sql
--
-- NO SE PUEDE DESHACER. Haga una copia antes:
--   docker compose exec db pg_dump -U inventarios inventarios > respaldo.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Diagnóstico: ¿qué referencia a los productos?
-- ---------------------------------------------------------------------------
SELECT 'productos'                  AS tabla, count(*) FROM productos
UNION ALL SELECT 'existencias',              count(*) FROM existencias
UNION ALL SELECT 'kardex',                   count(*) FROM kardex
UNION ALL SELECT 'capas_existencia',         count(*) FROM capas_existencia
UNION ALL SELECT 'solicitud_compra_detalles',count(*) FROM solicitud_compra_detalles
UNION ALL SELECT 'ingreso_detalles',         count(*) FROM ingreso_detalles
UNION ALL SELECT 'salida_detalles',          count(*) FROM salida_detalles
UNION ALL SELECT 'transferencia_detalles',   count(*) FROM transferencia_detalles;

-- Si todo lo que está DEBAJO de "productos" da 0, el borrado va a funcionar.
-- Si no, detenga acá y corra primero `php artisan inventario:reiniciar`.

-- ---------------------------------------------------------------------------
-- 2. El borrado
-- ---------------------------------------------------------------------------
BEGIN;

-- Las existencias en cero se borran igual: sin producto no significan nada.
DELETE FROM existencias;

-- RESTART IDENTITY devuelve los códigos internos a 1. Los códigos visibles
-- (PAP-0001) los asigna el sistema al crear, así que también reinician.
TRUNCATE TABLE productos RESTART IDENTITY CASCADE;

COMMIT;

-- ---------------------------------------------------------------------------
-- 3. Verificación
-- ---------------------------------------------------------------------------
SELECT 'productos' AS tabla, count(*) FROM productos
UNION ALL SELECT 'existencias', count(*) FROM existencias;

-- Los catálogos que SÍ se conservan: son los que los productos necesitan.
SELECT 'categorias'      AS catalogo, count(*) FROM categorias
UNION ALL SELECT 'unidades_medida', count(*) FROM unidades_medida
UNION ALL SELECT 'almacenes',       count(*) FROM almacenes;
