<?php

namespace App\Modules\Comun\Support;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Ejecuta los scripts SQL del modelo (database/sql/cargas) desde migraciones,
 * seeders y pruebas.
 *
 * Los scripts son la fuente única del modelo: se escribieron y probaron en
 * PostgreSQL (EXCLUDE, columnas generadas, triggers, reglas diferidas) y se
 * ejecutan tal cual. Solo se quita lo que en Laravel maneja el framework:
 *   - BEGIN; / COMMIT; / ROLLBACK; de nivel superior (la migración ya corre
 *     dentro de una transacción),
 *   - comandos de psql que empiezan con barra invertida (\set, \echo…),
 *   - cualquier SET search_path (red de seguridad, ver la historia del bug en
 *     la migración de activos: un search_path que queda en la conexión manda
 *     las tablas de Spatie y Sanctum al esquema equivocado).
 */
final class ScriptSql
{
    public const CARPETA = 'sql/cargas';

    public static function ruta(string $archivo): string
    {
        return database_path(self::CARPETA . '/' . $archivo);
    }

    public static function leer(string $ruta): string
    {
        if (! is_file($ruta)) {
            throw new RuntimeException("No existe el script SQL: {$ruta}");
        }

        return self::limpiar((string) file_get_contents($ruta));
    }

    public static function limpiar(string $sql): string
    {
        // Solo líneas que son EXACTAMENTE la orden, en la columna 0. El BEGIN de
        // un bloque PL/pgSQL va sin punto y coma y no se toca.
        $sql = preg_replace('/^(BEGIN|COMMIT|ROLLBACK);[ \t]*\r?$/mi', '', $sql);
        $sql = preg_replace('/^\\\\\S.*$/m', '', $sql);
        $sql = preg_replace('/^\s*SET\s+search_path.*$/mi', '', $sql);

        return $sql;
    }

    public static function ejecutar(string $archivo): void
    {
        DB::unprepared(self::leer(self::ruta($archivo)));

        // Los scripts no tocan el search_path, pero restaurarlo cuesta nada y
        // protege a las migraciones que corren después en la misma conexión.
        DB::statement('SET search_path TO public');
    }

    /**
     * Tablas que un script crea en un esquema (CREATE TABLE esquema.tabla).
     * Es el inventario de lo propio que usa bajarEsquema().
     *
     * @return list<string>
     */
    public static function tablasDeclaradas(string $archivo, string $esquema): array
    {
        $sql = (string) file_get_contents(self::ruta($archivo));
        preg_match_all('/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?' . preg_quote($esquema, '/') . '\.([a-z_][a-z0-9_]*)/mi', $sql, $m);

        return array_values(array_unique($m[1]));
    }

    /**
     * down() de las migraciones: borra el esquema solo si contiene únicamente
     * las tablas que su script declara. Si encuentra tablas ajenas (por
     * ejemplo, creadas ahí por un search_path contaminado), se detiene y las
     * nombra en lugar de llevárselas con el CASCADE. Mismo criterio que la
     * migración de activos.
     */
    public static function bajarEsquema(string $esquema, string $archivo): void
    {
        if (! DB::selectOne('select 1 as x from pg_namespace where nspname = ?', [$esquema])) {
            return;
        }

        $presentes = array_column(DB::select(
            "select table_name from information_schema.tables
              where table_schema = ? and table_type = 'BASE TABLE' order by table_name",
            [$esquema]
        ), 'table_name');

        $ajenas = array_values(array_diff($presentes, self::tablasDeclaradas($archivo, $esquema)));

        if ($ajenas !== []) {
            throw new RuntimeException(sprintf(
                "No se revierte: el esquema «%s» contiene %d tabla(s) que su script no crea: %s. "
                . 'Muévalas a public o bórrelas a mano; un DROP SCHEMA … CASCADE se las llevaría.',
                $esquema, count($ajenas), implode(', ', $ajenas)
            ));
        }

        DB::unprepared("DROP SCHEMA {$esquema} CASCADE");
    }

    /**
     * Antes de crear un esquema desde cero. Si el esquema ya existe pero su
     * migración no figura como ejecutada, quedó huérfano de un db:wipe o
     * migrate:fresh (Laravel solo borra las tablas del search_path).
     *
     * - local / testing: se borra y se recrea.
     * - cualquier otro entorno: se DETIENE sin tocar nada. Un DROP ... CASCADE
     *   también se llevaría las claves foráneas que otros esquemas tienen hacia
     *   este (caja → comun, cargas → caja), aunque el esquema esté vacío.
     */
    public static function prepararEsquema(string $esquema, bool $permitirBorrar = false): void
    {
        if (! preg_match('/^[a-z_][a-z0-9_]*$/', $esquema)) {
            throw new RuntimeException("Nombre de esquema no válido: {$esquema}");
        }

        $existe = DB::selectOne('select 1 as x from pg_namespace where nspname = ?', [$esquema]);
        if (! $existe) {
            return;
        }

        if (! $permitirBorrar) {
            throw new RuntimeException(
                "El esquema «{$esquema}» ya existe, pero su migración no figura como ejecutada. "
                . 'No se borra nada automáticamente fuera de local/testing: revise la tabla migrations antes de continuar.'
            );
        }

        DB::unprepared("DROP SCHEMA {$esquema} CASCADE");
    }
}
