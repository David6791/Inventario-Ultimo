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
        | Solicitud de material: pide material que SALDRÁ del almacén.
        | Una vez aprobada, genera una nota de salida contra sus saldos.
        |
        | Comparte la forma general con la solicitud de compra, pero no la tabla.
        | Además de la integridad referencial hacia salidas, las dos van a
        | divergir: esta llevará centro de costo y destino, la de compra llevará
        | proveedor, cotizaciones y modalidad de contratación.
        */
        Schema::create('solicitudes_material', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 40)->unique();          // SM-ALM-CEN-2026-0001
            $table->foreignId('almacen_id')->constrained('almacenes');
            $table->date('fecha');

            $table->string('unidad_solicitante', 150);
            $table->string('solicitante', 150);
            $table->text('justificacion')->nullable();

            // Propio de una salida: a qué se imputa el consumo.
            $table->string('centro_costo', 60)->nullable();
            $table->string('destino', 200)->nullable();

            $table->string('estado', 20)->default('borrador');

            $table->string('documento_ruta', 255)->nullable();
            $table->string('documento_nombre', 200)->nullable();
            $table->date('fecha_aprobacion')->nullable();
            $table->string('observacion_aprobacion', 300)->nullable();

            $table->foreignId('registrado_por')->constrained('users');
            $table->foreignId('aprobado_por')->nullable()->constrained('users');

            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->index(['almacen_id', 'estado']);
            $table->index('fecha');
        });

        Schema::create('solicitud_material_detalles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('solicitud_material_id')
                ->constrained('solicitudes_material')->cascadeOnDelete();
            $table->foreignId('producto_id')->constrained('productos');

            $table->decimal('cantidad', 14, 4);
            $table->decimal('cantidad_atendida', 14, 4)->default(0);

            $table->string('especificacion', 300)->nullable();
            $table->timestamps();

            $table->unique(['solicitud_material_id', 'producto_id']);
        });

        DB::statement("ALTER TABLE solicitudes_material ADD CONSTRAINT sm_estado_valido CHECK (estado IN ('borrador','aprobada','rechazada','atendida_parcial','atendida','anulada'))");
        DB::statement('ALTER TABLE solicitud_material_detalles ADD CONSTRAINT smd_cantidad_positiva CHECK (cantidad > 0)');
        DB::statement('ALTER TABLE solicitud_material_detalles ADD CONSTRAINT smd_atendida_no_excede CHECK (cantidad_atendida >= 0 AND cantidad_atendida <= cantidad)');
    }

    public function down(): void
    {
        Schema::dropIfExists('solicitud_material_detalles');
        Schema::dropIfExists('solicitudes_material');
    }
};
