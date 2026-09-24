<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
        | Saldo actual por producto y almacén.
        |
        | Es una tabla de saldo, no de movimientos: el histórico vive en el
        | kardex. Se mantiene con los ingresos, salidas y ajustes que confirman
        | movimiento, y existe para responder rápido "¿cuánto hay?" sin sumar
        | todo el kardex en cada consulta.
        */
        Schema::create('existencias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('producto_id')->constrained('productos');
            $table->foreignId('almacen_id')->constrained('almacenes');

            $table->decimal('cantidad', 14, 4)->default(0);

            // Costo promedio ponderado. Se recalcula en cada ingreso.
            $table->decimal('costo_promedio', 14, 4)->default(0);

            $table->string('ubicacion_fisica', 60)->nullable(); // estante, pasillo
            $table->timestamp('ultimo_movimiento_en')->nullable();
            $table->timestamps();

            $table->unique(['producto_id', 'almacen_id']);
            $table->index('almacen_id');
        });

        // El saldo nunca puede ser negativo. Si un cálculo intenta dejarlo así,
        // la transacción falla antes de romper el kardex.
        DB::statement('ALTER TABLE existencias ADD CONSTRAINT existencias_no_negativas CHECK (cantidad >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('existencias');
    }
};
