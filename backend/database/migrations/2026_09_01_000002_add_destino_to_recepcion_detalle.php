<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Punto de integración con el sistema de almacenes.
 *
 * Agrega al detalle de recepción la columna que decide si la línea recibida
 * se queda en kardex, se convierte en activo fijo, se registra como bien de
 * control o se consume directamente.
 *
 * AJUSTAR la constante TABLA al nombre real del proyecto antes de migrar.
 */
return new class extends Migration
{
    private const TABLA = 'recepcion_detalle';   // <-- ajustar

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLA)) {
            // No falla la migración: permite desplegar el módulo antes de
            // integrar con almacenes. Se vuelve a correr cuando exista.
            return;
        }

        if (Schema::hasColumn(self::TABLA, 'destino')) {
            return;
        }

        $tabla = self::TABLA;

        DB::statement("
            ALTER TABLE public.{$tabla}
            ADD COLUMN destino varchar(15) NOT NULL DEFAULT 'INVENTARIO'
            CHECK (destino IN ('INVENTARIO','ACTIVO_FIJO','BIEN_CONTROL','CONSUMO_DIRECTO'))
        ");

        DB::statement("
            COMMENT ON COLUMN public.{$tabla}.destino IS
            'Define el tratamiento de la línea al confirmar la recepción. ACTIVO_FIJO genera una fila en activos.activo por cada unidad.'
        ");
    }

    public function down(): void
    {
        if (Schema::hasTable(self::TABLA) && Schema::hasColumn(self::TABLA, 'destino')) {
            DB::statement('ALTER TABLE public.' . self::TABLA . ' DROP COLUMN destino');
        }
    }
};
