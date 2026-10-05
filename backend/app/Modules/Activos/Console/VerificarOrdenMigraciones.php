<?php

namespace App\Modules\Activos\Console;

use Illuminate\Console\Command;

/**
 * Detecta migraciones que referencian tablas creadas DESPUÉS que ellas.
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * Una base que se fue construyendo por partes funciona aunque el orden de las
 * migraciones esté mal: las tablas se crearon en el momento en que cada una
 * se agregó, no en el orden del nombre del archivo. El desorden recién se
 * nota cuando alguien corre `migrate` sobre una base virgen —un compañero
 * nuevo, un servidor limpio, o `RefreshDatabase` en las pruebas— y falla con
 * «relation X does not exist».
 *
 * Descubrirlo así es caro: se arregla una, se vuelve a correr, aparece la
 * siguiente. Este comando lo detecta todo de una vez, sin tocar la base.
 *
 *   php artisan activos:verificar-migraciones
 */
class VerificarOrdenMigraciones extends Command
{
    protected $signature = 'activos:verificar-migraciones
                            {--ruta= : Carpeta de migraciones (por defecto database/migrations)}';

    protected $description = 'Detecta migraciones que referencian tablas creadas después que ellas';

    public function handle(): int
    {
        $ruta = $this->option('ruta') ?: database_path('migrations');

        $archivos = collect(glob($ruta . '/*.php'))->sort()->values();

        if ($archivos->isEmpty()) {
            $this->error("No se encontraron migraciones en {$ruta}");
            return self::FAILURE;
        }

        $this->info("Analizando {$archivos->count()} migraciones…");
        $this->newLine();

        // tabla => índice de la migración que la crea
        $creadaEn = [];
        // [índice, archivo, tabla referenciada, tipo]
        $referencias = [];

        foreach ($archivos as $i => $archivo) {
            $contenido = file_get_contents($archivo);
            $nombre = basename($archivo);

            foreach ($this->tablasCreadas($contenido) as $tabla) {
                // Si una tabla se crea dos veces, la primera manda.
                $creadaEn[$tabla] ??= $i;
            }

            foreach ($this->tablasReferenciadas($contenido) as [$tabla, $tipo]) {
                $referencias[] = [$i, $nombre, $tabla, $tipo];
            }
        }

        $problemas = [];

        foreach ($referencias as [$indice, $nombre, $tabla, $tipo]) {
            if (! isset($creadaEn[$tabla])) {
                // Puede ser una tabla de un paquete (Spatie, Sanctum) o del
                // schema activos: no es un problema de orden.
                continue;
            }

            if ($creadaEn[$tabla] > $indice) {
                $problemas[] = [
                    'migracion' => $nombre,
                    'referencia'=> $tabla,
                    'tipo'      => $tipo,
                    'creada_en' => basename($archivos[$creadaEn[$tabla]]),
                ];
            }
        }

        if (empty($problemas)) {
            $this->info('  Sin problemas de orden. Las migraciones corren sobre una base virgen.');
            $this->newLine();
            return self::SUCCESS;
        }

        $this->error("  Se encontraron " . count($problemas) . " referencia(s) a tablas creadas después.");
        $this->newLine();

        $this->table(
            ['Migración', 'Referencia', 'Tipo', 'La tabla se crea en'],
            array_map(fn ($p) => [
                $p['migracion'], $p['referencia'], $p['tipo'], $p['creada_en'],
            ], $problemas)
        );

        $this->newLine();
        $this->comment('  Cómo corregirlo');
        $this->line('  Renombre cada migración de la izquierda con un timestamp POSTERIOR');
        $this->line('  al de la migración de la derecha. Deje huecos entre números por si');
        $this->line('  hay dependencias intermedias.');
        $this->newLine();
        $this->line('  Si esas migraciones YA corrieron en producción, los registros de la');
        $this->line('  tabla `migrations` quedan con el nombre viejo: agregue una migración');
        $this->line('  previa que los actualice, o Laravel intentará ejecutarlas de nuevo.');
        $this->newLine();

        return self::FAILURE;
    }

    /** @return list<string> */
    private function tablasCreadas(string $contenido): array
    {
        preg_match_all(
            "/Schema::(?:connection\([^)]*\)->)?create\(\s*['\"]([^'\"]+)['\"]/",
            $contenido, $coincidencias
        );

        return array_map([$this, 'limpiarSchema'], $coincidencias[1] ?? []);
    }

    /**
     * Devuelve las tablas que la migración referencia por clave foránea.
     *
     * @return list<array{0:string,1:string}>
     */
    private function tablasReferenciadas(string $contenido): array
    {
        $tablas = [];

        // ->foreign('x')->references('id')->on('tabla')
        preg_match_all("/->on\(\s*['\"]([^'\"]+)['\"]/", $contenido, $m);
        foreach ($m[1] ?? [] as $t) {
            $tablas[] = [$this->limpiarSchema($t), 'foreign'];
        }

        // ->constrained('tabla')
        preg_match_all("/->constrained\(\s*['\"]([^'\"]+)['\"]/", $contenido, $m);
        foreach ($m[1] ?? [] as $t) {
            $tablas[] = [$this->limpiarSchema($t), 'constrained'];
        }

        // foreignId('tabla_id')->constrained()  — Laravel infiere el plural
        preg_match_all(
            "/foreignId\(\s*['\"](\w+)_id['\"]\s*\)\s*->\s*constrained\(\s*\)/",
            $contenido, $m
        );
        foreach ($m[1] ?? [] as $singular) {
            $tablas[] = [$this->pluralizar($singular), 'constrained inferido'];
        }

        // Schema::table('x') sobre una tabla que debe existir
        preg_match_all(
            "/Schema::(?:connection\([^)]*\)->)?table\(\s*['\"]([^'\"]+)['\"]/",
            $contenido, $m
        );
        foreach ($m[1] ?? [] as $t) {
            $tablas[] = [$this->limpiarSchema($t), 'alter'];
        }

        return array_values(array_unique($tablas, SORT_REGULAR));
    }

    /** Quita el prefijo de schema: "public.users" => "users". */
    private function limpiarSchema(string $tabla): string
    {
        return str_contains($tabla, '.') ? explode('.', $tabla)[1] : $tabla;
    }

    private function pluralizar(string $palabra): string
    {
        return \Illuminate\Support\Str::plural($palabra);
    }
}
