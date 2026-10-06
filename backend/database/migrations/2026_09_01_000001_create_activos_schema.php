<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Crea el schema `activos` a partir del DDL versionado.
 *
 * Se ejecuta el SQL en lugar de traducirlo al Schema Builder porque el diseño
 * usa CHECK constraints, columnas generadas e índices parciales que el builder
 * no expresa sin raw statements de todos modos. El archivo SQL es la fuente de
 * verdad del modelo y queda versionado junto al código.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * HISTORIA DE UN BUG, PARA QUE NO SE REPITA
 *
 * La primera versión de esta migración dejaba que el DDL ejecutara
 *
 *     SET search_path TO activos, public;
 *
 * Ese SET no termina con la sentencia: persiste en la CONEXIÓN. Las
 * migraciones que corrían después (Spatie, Sanctum) creaban sus tablas sin
 * calificar el schema, y PostgreSQL las ubicaba en el primero del search_path,
 * es decir `activos`. Quedaban ahí sin que nadie lo notara, hasta que un
 * `migrate:rollback` ejecutaba DROP SCHEMA activos CASCADE y se llevaba
 * permissions, roles, model_has_roles y personal_access_tokens por delante.
 *
 * Correcciones:
 *   1. El DDL ya no toca el search_path (todo está calificado con activos.).
 *   2. up() restaura el search_path explícitamente por si el archivo cambia.
 *   3. down() verifica que en el schema solo haya objetos propios antes de
 *      borrar nada, y aborta nombrando los intrusos si encuentra otros.
 * ────────────────────────────────────────────────────────────────────────────
 */
return new class extends Migration
{
    private string $sqlPath = 'sql/activos_schema.sql';

    /**
     * Tablas que este módulo crea. Sirve de inventario para que down() pueda
     * distinguir lo propio de lo ajeno. Al agregar tablas en sprints
     * siguientes, agregarlas también acá.
     */
    private const TABLAS_PROPIAS = [
        'parametro', 'clase', 'subclase', 'ubicacion', 'secuencia',
        'activo', 'activo_costo', 'mejora',
        'cierre', 'valuacion', 'prueba_valor_recuperable',
        'revaluo', 'revaluo_detalle',
        'documento', 'documento_detalle', 'movimiento',
        'plan_mantenimiento', 'mantenimiento', 'poliza', 'poliza_activo',
        'inventario', 'inventario_comision', 'inventario_detalle', 'inventario_ajuste',
        'adjunto',
    ];

    public function up(): void
    {
        DB::statement('DROP SCHEMA IF EXISTS activos CASCADE');
        $path = database_path($this->sqlPath);

        if (! file_exists($path)) {
            throw new RuntimeException("No se encontró el DDL en {$path}");
        }

        $sql = file_get_contents($path);

        // Red de seguridad: si alguien reintroduce un SET search_path en el
        // DDL, acá no llega a la conexión.
        $sql = preg_replace('/^\s*SET\s+search_path.*$/mi', '', $sql);

        DB::unprepared($sql);

        // El DDL no debería alterar el search_path, pero restaurarlo explícito
        // cuesta nada y evita que una sentencia futura contamine la conexión
        // para las migraciones siguientes.
        DB::statement("SET search_path TO public");
    }

    public function down(): void
    {
        if (! $this->existeSchema()) {
            return;
        }

        $intrusos = $this->tablasAjenas();

        if (! empty($intrusos)) {
            throw new RuntimeException(sprintf(
                "No se revierte: el schema `activRos` contiene %d tabla(s) que este módulo no creó:\n  %s\n\n"
                ."Esto suele significar que alguna migración las creó ahí por un search_path contaminado.\n"
                ."Muévalas a `public` antes de revertir, o bórrelas a mano si no sirven.\n"
                ."Un DROP SCHEMA ... CASCADE acá se las llevaría por delante.",
                count($intrusos),
                implode("\n  ", $intrusos)
            ));
        }

        // Llegado este punto en el schema solo hay objetos de este módulo:
        // el CASCADE resuelve las dependencias internas y no alcanza a public,
        // porque ninguna tabla de public referencia a `activos`.
        DB::statement('DROP SCHEMA activos CASCADE');
    }

    private function existeSchema(): bool
    {
        return (bool) DB::selectOne(
            "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'activos'"
        );
    }

    /** @return list<string> tablas presentes en `activos` que no son del módulo */
    private function tablasAjenas(): array
    {
        $presentes = DB::select(
            "SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'activos' AND table_type = 'BASE TABLE'
             ORDER BY table_name"
        );

        $nombres = array_map(fn ($f) => $f->table_name, $presentes);

        return array_values(array_diff($nombres, self::TABLAS_PROPIAS));
    }
};