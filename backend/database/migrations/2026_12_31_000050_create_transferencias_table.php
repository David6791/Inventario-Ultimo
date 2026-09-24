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
        | Traslado de material entre almacenes.
        |
        | Tiene tránsito: se despacha del origen y se recibe en el destino, en
        | dos momentos distintos. Entre medio el material no está en ningún
        | almacén — figura solo en la transferencia. Sumarlo al destino al
        | despacharlo mostraría existencias que todavía no están en el estante.
        */
        Schema::create('transferencias', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 40)->unique();   // TR-ALM-CEN-2026-0001

            $table->foreignId('almacen_origen_id')->constrained('almacenes');
            $table->foreignId('almacen_destino_id')->constrained('almacenes');

            $table->date('fecha');
            $table->text('motivo')->nullable();

            $table->string('estado', 20)->default('borrador');
            // borrador → despachada (en tránsito) → recibida
            //          ↘ anulada

            // Quién lleva físicamente el material.
            $table->string('transportista', 150)->nullable();

            $table->timestamp('despachada_en')->nullable();
            $table->foreignId('despachada_por')->nullable()->constrained('users');

            $table->timestamp('recibida_en')->nullable();
            $table->foreignId('recibida_por')->nullable()->constrained('users');
            $table->string('observacion_recepcion', 300)->nullable();

            $table->string('motivo_anulacion', 300)->nullable();
            $table->timestamp('anulada_en')->nullable();
            $table->foreignId('anulada_por')->nullable()->constrained('users');

            $table->foreignId('registrado_por')->constrained('users');
            $table->timestamps();

            $table->index(['almacen_origen_id', 'estado']);
            $table->index(['almacen_destino_id', 'estado']);
            $table->index('fecha');
        });

        // Origen y destino no pueden ser el mismo almacén.
        DB::statement('ALTER TABLE transferencias ADD CONSTRAINT transferencia_almacenes_distintos CHECK (almacen_origen_id <> almacen_destino_id)');
        DB::statement("ALTER TABLE transferencias ADD CONSTRAINT transferencia_estado_valido CHECK (estado IN ('borrador','despachada','recibida','anulada'))");

        Schema::create('transferencia_detalles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transferencia_id')->constrained('transferencias')->cascadeOnDelete();
            $table->foreignId('producto_id')->constrained('productos');

            $table->decimal('cantidad', 14, 4);

            // Lo que efectivamente llegó. Puede ser menos: rotura, faltante en
            // el camino. La diferencia queda documentada, no se pierde.
            $table->decimal('cantidad_recibida', 14, 4)->nullable();

            $table->string('observacion', 300)->nullable();
            $table->timestamps();

            $table->unique(['transferencia_id', 'producto_id']);
        });

        DB::statement('ALTER TABLE transferencia_detalles ADD CONSTRAINT td_cantidad_positiva CHECK (cantidad > 0)');

        /*
        | El costo que viaja con el material.
        |
        | Al despachar se consumen capas del origen, y acá queda anotado cuánto
        | salió de cada una y a qué precio. Al recibir, esas mismas capas se
        | replican en el destino con su precio original.
        |
        | Sin esto, una transferencia crearía o destruiría valor: el material
        | entraría al destino a un precio inventado y el inventario valorizado
        | dejaría de cuadrar contra contabilidad.
        */
        Schema::create('transferencia_capas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transferencia_detalle_id')
                ->constrained('transferencia_detalles')->cascadeOnDelete();
            $table->foreignId('capa_origen_id')->constrained('capas_existencia');

            $table->decimal('cantidad', 14, 4);
            $table->decimal('costo_unitario', 14, 4);

            $table->string('lote', 60)->nullable();
            $table->date('fecha_vencimiento')->nullable();

            $table->timestamps();

            $table->index('transferencia_detalle_id');
        });

        DB::statement('ALTER TABLE transferencia_capas ADD CONSTRAINT tc_cantidad_positiva CHECK (cantidad > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('transferencia_capas');
        Schema::dropIfExists('transferencia_detalles');
        Schema::dropIfExists('transferencias');
    }
};
