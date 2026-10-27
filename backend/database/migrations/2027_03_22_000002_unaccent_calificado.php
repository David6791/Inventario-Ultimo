<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * inmutable_unaccent() llamaba a unaccent() sin esquema. pg_restore corre con
 * search_path vacío: al restaurar un respaldo no encontraba unaccent() y el
 * índice de búsqueda de productos no se creaba (la copia quedaba sin él).
 * Con el esquema escrito, el respaldo se restaura entero. Si el índice falta
 * (una base restaurada antes de este arreglo), se crea.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION public.inmutable_unaccent(text)
            RETURNS text
            LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
            AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$
        SQL);

        DB::statement(<<<'SQL'
            CREATE INDEX IF NOT EXISTS productos_nombre_busqueda
            ON public.productos
            USING gin (lower(public.inmutable_unaccent(nombre)) public.gin_trgm_ops)
        SQL);
    }

    public function down(): void
    {
        // La versión con esquema es equivalente: no hay nada que deshacer.
    }
};
