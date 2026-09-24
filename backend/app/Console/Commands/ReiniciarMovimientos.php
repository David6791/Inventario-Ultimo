<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Borra todos los movimientos y deja el sistema como recién instalado, pero
 * conservando los catálogos: productos, categorías, almacenes, unidades,
 * solicitantes, usuarios y roles.
 *
 * Pensado para cuando se termina de probar y se quiere empezar con datos
 * reales, sin volver a cargar todo el catálogo a mano.
 */
class ReiniciarMovimientos extends Command
{
    protected $signature = 'inventario:reiniciar
                            {--force : No pedir confirmación}
                            {--conservar-archivos : No borrar los PDF adjuntos}
                            {--con-productos : Vaciar también el catálogo de productos}';

    protected $description = 'Borra solicitudes, ingresos, salidas, transferencias, kardex y existencias, conservando los catálogos';

    /**
     * El orden importa: primero lo que referencia, después lo referenciado.
     *
     * Se usa TRUNCATE con RESTART IDENTITY para que los identificadores vuelvan
     * a empezar en 1. CASCADE cubre cualquier dependencia que se agregue
     * después y que no esté en esta lista.
     */
    private const TABLAS = [
        // Costeo PEPS
        'consumos_capa',
        'transferencia_capas',

        // Transferencias
        'transferencia_detalles',
        'transferencias',

        // Salidas
        'salida_detalles',
        'salidas',

        // Ingresos
        'ingreso_detalles',
        'ingresos',

        // Solicitudes de compra
        'solicitud_compra_detalles',
        'solicitudes_compra',

        // Inventario
        'kardex',
        'capas_existencia',
        'existencias',

        // Numeración: sin esto, el próximo documento seguiría en 0007
        'contadores_documento',
    ];

    /** Carpetas de respaldos escaneados. */
    private const CARPETAS = ['solicitudes', 'salidas', 'ingresos'];

    public function handle(): int
    {
        $this->mostrarResumen();

        if (! $this->option('force') && ! $this->confirm('¿Borrar todos los movimientos?', false)) {
            $this->components->warn('Cancelado. No se borró nada.');
            return self::SUCCESS;
        }

        // Segunda confirmación en producción: este comando no tiene vuelta atrás.
        if (app()->environment('production') && ! $this->option('force')) {
            $this->newLine();
            $this->components->error('Está en PRODUCCIÓN. Esta acción no se puede deshacer.');

            if ($this->ask('Escriba el nombre de la base de datos para continuar') !== config('database.connections.pgsql.database')) {
                $this->components->warn('El nombre no coincide. Cancelado.');
                return self::FAILURE;
            }
        }

        $this->vaciarTablas();

        if ($this->option('con-productos')) {
            $this->vaciarProductos();
        }

        if (! $this->option('conservar-archivos')) {
            $this->borrarArchivos();
        }

        $this->newLine();
        $this->components->info('Listo. Los catálogos quedaron intactos y la numeración vuelve a empezar en 0001.');

        return self::SUCCESS;
    }

    private function mostrarResumen(): void
    {
        $this->newLine();
        $this->components->twoColumnDetail('<fg=yellow>Se va a BORRAR</>', '');

        foreach ($this->conteos() as $tabla => $filas) {
            if ($filas > 0) {
                $this->components->twoColumnDetail("  {$tabla}", "{$filas} fila(s)");
            }
        }

        $this->newLine();
        $this->components->twoColumnDetail('<fg=green>Se CONSERVA</>', '');

        foreach (['productos', 'categorias', 'unidades_medida', 'almacenes',
                  'unidades_solicitantes', 'solicitantes', 'users', 'roles'] as $tabla) {
            $this->components->twoColumnDetail("  {$tabla}", DB::table($tabla)->count().' fila(s)');
        }

        $this->newLine();
    }

    /** @return array<string, int> */
    private function conteos(): array
    {
        $conteos = [];

        foreach (self::TABLAS as $tabla) {
            // Una tabla puede no existir si el módulo todavía no se instaló.
            $conteos[$tabla] = DB::getSchemaBuilder()->hasTable($tabla)
                ? DB::table($tabla)->count()
                : 0;
        }

        return $conteos;
    }

    private function vaciarTablas(): void
    {
        $this->newLine();

        DB::transaction(function () {
            foreach (self::TABLAS as $tabla) {
                if (! DB::getSchemaBuilder()->hasTable($tabla)) {
                    continue;
                }

                DB::statement("TRUNCATE TABLE {$tabla} RESTART IDENTITY CASCADE");
                $this->components->task("Vaciando {$tabla}", fn () => true);
            }
        });
    }

    /**
     * Vacía el catálogo de productos.
     *
     * Va después de los movimientos y no en la lista principal: un producto
     * referenciado por un kardex no se puede borrar, así que este paso solo
     * tiene sentido cuando lo anterior ya se limpió.
     *
     * Categorías, unidades y almacenes se conservan: son lo que los productos
     * nuevos van a necesitar.
     */
    private function vaciarProductos(): void
    {
        $this->newLine();

        DB::transaction(function () {
            DB::statement('TRUNCATE TABLE productos RESTART IDENTITY CASCADE');
            $this->components->task('Vaciando productos', fn () => true);
        });
    }

    /**
     * Los PDF escaneados de documentos que ya no existen solo ocupan espacio y
     * confunden: no hay forma de saber a qué correspondían.
     */
    private function borrarArchivos(): void
    {
        $this->newLine();

        foreach (self::CARPETAS as $carpeta) {
            if (! Storage::disk('local')->exists($carpeta)) {
                continue;
            }

            $archivos = count(Storage::disk('local')->allFiles($carpeta));
            Storage::disk('local')->deleteDirectory($carpeta);

            $this->components->task("Borrando {$archivos} archivo(s) de {$carpeta}", fn () => true);
        }
    }
}
