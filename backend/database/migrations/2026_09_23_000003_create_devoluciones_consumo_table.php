<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Espejo de consumos_capa. Cada fila restituye cantidad a la capa
        // de la que salio, al costo con que salio. Nunca al costo actual.
        Schema::create('devoluciones_consumo', function (Blueprint $tabla) {
            $tabla->id();
            $tabla->foreignId('devolucion_detalle_id')->constrained('devoluciones_detalle')->cascadeOnDelete();
            $tabla->foreignId('consumo_capa_id')->constrained('consumos_capa');
            $tabla->foreignId('capa_id')->constrained('capas_existencia');

            $tabla->decimal('cantidad', 14, 4);
            $tabla->decimal('costo_unitario', 14, 4);
            $tabla->decimal('costo_total', 14, 2);
            $tabla->timestamps();

            $tabla->index('devolucion_detalle_id');
            $tabla->index('consumo_capa_id');
            $tabla->index('capa_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devoluciones_consumo');
    }
};
