<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('devoluciones_detalle')) {
            return; // ver 2026_12_31_000040
        }

        Schema::create('devoluciones_detalle', function (Blueprint $tabla) {
            $tabla->id();
            $tabla->foreignId('devolucion_id')->constrained('devoluciones')->cascadeOnDelete();

            // La linea de salida de la que proviene. Es el ancla del costeo.
            $tabla->foreignId('salida_detalle_id')->constrained('salida_detalles');
            $tabla->foreignId('producto_id')->constrained('productos');

            $tabla->string('producto_codigo', 30);
            $tabla->string('producto_nombre', 200);
            $tabla->string('unidad_medida', 20)->nullable();

            $tabla->decimal('cantidad', 14, 4);
            $tabla->decimal('costo_total', 14, 2)->default(0);  // suma de sus devoluciones_consumo
            $tabla->string('estado_bien', 20)->default('bueno'); // bueno | danado
            $tabla->text('observaciones')->nullable();
            $tabla->timestamps();

            $tabla->index('devolucion_id');
            $tabla->index('salida_detalle_id');
            $tabla->index('producto_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devoluciones_detalle');
    }
};
