<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Crea el schema `activos` completo a partir del DDL versionado.
 *
 * Se ejecuta el SQL en lugar de traducirlo al Schema Builder porque el diseño
 * usa CHECK constraints, columnas generadas e índices parciales que el builder
 * no expresa sin raw statements de todos modos. El archivo SQL es la fuente
 * de verdad del modelo y queda versionado junto al código.
 */
return new class extends Migration
{
    private string $sqlPath = 'sql/activos_schema.sql';

    public function up(): void
    {
        $path = database_path($this->sqlPath);

        if (! file_exists($path)) {
            throw new RuntimeException("No se encontró el DDL en {$path}");
        }

        DB::unprepared(file_get_contents($path));
    }

    public function down(): void
    {
        // CASCADE elimina tablas, vistas, índices y constraints del schema.
        // No toca nada de `public`.
        DB::statement('DROP SCHEMA IF EXISTS activos CASCADE');
    }
};
