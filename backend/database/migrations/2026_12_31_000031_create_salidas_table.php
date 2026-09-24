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
        | Nota de salida: entrega de material desde el almacén.
        |
        | Es el documento único de salida: no hay una solicitud previa. El
        | almacenero registra lo que entrega, imprime la nota, la hace firmar
        | por quien recibe, y sube el escaneo como respaldo.
        */
        Schema::create('salidas', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 40)->unique();   // NS-ALM-CEN-2026-0001
            $table->foreignId('almacen_id')->constrained('almacenes');
            $table->date('fecha');

            $table->string('unidad_solicitante', 150);
            $table->string('solicitante', 150);       // quien pide
            $table->string('recibido_por', 150);      // quien firma al retirar
            $table->string('centro_costo', 60)->nullable();
            $table->string('destino', 200)->nullable();
            $table->text('motivo')->nullable();

            $table->string('estado', 20)->default('borrador');
            // borrador → confirmada → anulada

            // El escaneo firmado. Llega después de confirmar: el material sale
            // del almacén cuando se firma en el mostrador, y el papel se
            // digitaliza más tarde.
            $table->string('respaldo_ruta', 255)->nullable();
            $table->string('respaldo_nombre', 200)->nullable();
            $table->timestamp('respaldo_subido_en')->nullable();

            $table->timestamp('confirmada_en')->nullable();
            $table->foreignId('registrado_por')->constrained('users');
            $table->foreignId('confirmada_por')->nullable()->constrained('users');

            $table->string('motivo_anulacion', 300)->nullable();
            $table->timestamp('anulada_en')->nullable();
            $table->foreignId('anulada_por')->nullable()->constrained('users');

            $table->timestamps();

            $table->index(['almacen_id', 'estado']);
            $table->index('fecha');
            // Para el listado de "confirmadas sin respaldo"
            $table->index(['estado', 'respaldo_ruta']);
        });

        Schema::create('salida_detalles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('salida_id')->constrained('salidas')->cascadeOnDelete();
            $table->foreignId('producto_id')->constrained('productos');

            $table->decimal('cantidad', 14, 4);

            // Costo al momento de la salida. Se congela al confirmar: si el
            // promedio cambia después, este documento conserva su valor.
            $table->decimal('costo_unitario', 14, 4)->default(0);

            $table->string('observacion', 300)->nullable();
            $table->timestamps();

            $table->unique(['salida_id', 'producto_id']);
        });

        DB::statement("ALTER TABLE salidas ADD CONSTRAINT salidas_estado_valido CHECK (estado IN ('borrador','confirmada','anulada'))");
        DB::statement('ALTER TABLE salida_detalles ADD CONSTRAINT sd_cantidad_positiva CHECK (cantidad > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('salida_detalles');
        Schema::dropIfExists('salidas');
    }
};
