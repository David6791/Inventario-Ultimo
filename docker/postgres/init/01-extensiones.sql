-- Se ejecuta una sola vez, cuando el volumen de datos se crea vacío.
-- Si lo modificás después, hay que borrar el volumen: docker compose down -v

-- Búsqueda de productos por nombre sin acentos ni mayúsculas.
-- La va a necesitar el módulo de catálogo.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
