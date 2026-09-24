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
        | Contadores para la numeración correlativa. Es la única pieza que
        | comparten los dos tipos de solicitud, porque el mecanismo es idéntico
        | y la unicidad se garantiza por (almacen, tipo, gestión).
        |
        | Se bloquea con lockForUpdate al pedir número: un max(numero)+1 deja una
        | ventana entre el SELECT y el INSERT, y con dos personas cargando a la
        | vez eso pasa de verdad.
        */
        Schema::create('contadores_documento', function (Blueprint $table) {
            $table->id();
            $table->foreignId('almacen_id')->constrained('almacenes');
            $table->string('tipo', 30);
            $table->unsignedSmallInteger('gestion');
            $table->unsignedInteger('ultimo')->default(0);
            $table->timestamps();

            $table->unique(['almacen_id', 'tipo', 'gestion']);
        });

        /*
        | Solicitud de compra: pide material que ENTRARÁ al almacén.
        | Una vez aprobada, genera una nota de ingreso contra sus saldos.
        |
        | Tabla propia y no una columna `tipo` compartida con las solicitudes de
        | material: cuando exista `ingresos.solicitud_compra_id`, la clave
        | foránea garantiza que un ingreso no pueda colgarse de una solicitud de
        | material. Con tabla única eso no se puede verificar desde el esquema.
        */
        Schema::create('solicitudes_compra', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 40)->unique();          // SC-ALM-CEN-2026-0001
            $table->foreignId('almacen_id')->constrained('almacenes');
            $table->date('fecha');

            $table->string('unidad_solicitante', 150);
            $table->string('solicitante', 150);
            $table->text('justificacion')->nullable();

            // Propios de una compra. Acá no son anulables por conveniencia:
            // simplemente pueden no conocerse todavía al armar el borrador.
            $table->string('partida_presupuestaria', 20)->nullable();
            $table->decimal('monto_estimado', 14, 2)->nullable();

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

        Schema::create('solicitud_compra_detalles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('solicitud_compra_id')
                ->constrained('solicitudes_compra')->cascadeOnDelete();
            $table->foreignId('producto_id')->constrained('productos');

            $table->decimal('cantidad', 14, 4);

            // Lo ya recibido contra esta línea. El proveedor puede entregar 5 de
            // 10 hoy y 3 mañana; el saldo sale de acá.
            $table->decimal('cantidad_atendida', 14, 4)->default(0);

            $table->string('especificacion', 300)->nullable();
            $table->timestamps();

            $table->unique(['solicitud_compra_id', 'producto_id']);
        });

        DB::statement("ALTER TABLE solicitudes_compra ADD CONSTRAINT sc_estado_valido CHECK (estado IN ('borrador','aprobada','rechazada','atendida_parcial','atendida','anulada'))");
        DB::statement('ALTER TABLE solicitud_compra_detalles ADD CONSTRAINT scd_cantidad_positiva CHECK (cantidad > 0)');
        DB::statement('ALTER TABLE solicitud_compra_detalles ADD CONSTRAINT scd_atendida_no_excede CHECK (cantidad_atendida >= 0 AND cantidad_atendida <= cantidad)');
    }

    public function down(): void
    {
        Schema::dropIfExists('solicitud_compra_detalles');
        Schema::dropIfExists('solicitudes_compra');
        Schema::dropIfExists('contadores_documento');
    }
};
