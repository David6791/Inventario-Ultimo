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
        | Nota de ingreso: recepción de material en el almacén.
        |
        | Siempre nace de una solicitud de compra aprobada — por eso la clave
        | foránea es obligatoria. Es la tabla separada la que garantiza que un
        | ingreso no pueda colgarse de otra cosa.
        */
        Schema::create('ingresos', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 40)->unique();   // NI-ALM-CEN-2026-0001
            $table->foreignId('almacen_id')->constrained('almacenes');
            $table->foreignId('solicitud_compra_id')->constrained('solicitudes_compra');
            $table->date('fecha');

            // Sin catálogo de proveedores: se registra como texto, que alcanza
            // para el respaldo. Si más adelante hace falta, se agrega sin tocar
            // esta tabla.
            $table->string('proveedor', 200);
            $table->string('tipo_documento', 30);     // factura, nota de entrega, acta
            $table->string('numero_documento', 40)->nullable();
            $table->date('fecha_documento')->nullable();

            $table->string('estado', 20)->default('borrador');

            $table->string('respaldo_ruta', 255)->nullable();
            $table->string('respaldo_nombre', 200)->nullable();
            $table->timestamp('respaldo_subido_en')->nullable();

            $table->timestamp('confirmada_en')->nullable();
            $table->foreignId('registrado_por')->constrained('users');
            $table->foreignId('confirmada_por')->nullable()->constrained('users');

            $table->string('motivo_anulacion', 300)->nullable();
            $table->timestamp('anulada_en')->nullable();
            $table->foreignId('anulada_por')->nullable()->constrained('users');

            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->index(['almacen_id', 'estado']);
            $table->index('solicitud_compra_id');
            $table->index('fecha');
            $table->index(['estado', 'respaldo_ruta']);
        });

        Schema::create('ingreso_detalles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ingreso_id')->constrained('ingresos')->cascadeOnDelete();
            $table->foreignId('producto_id')->constrained('productos');

            // Contra qué línea de la solicitud se imputa. Es lo que descuenta
            // el saldo pendiente y permite la entrega parcial.
            $table->foreignId('solicitud_compra_detalle_id')
                ->constrained('solicitud_compra_detalles');

            $table->decimal('cantidad', 14, 4);
            $table->decimal('costo_unitario', 14, 4);

            // Se piden solo si el producto los controla.
            $table->string('lote', 60)->nullable();
            $table->date('fecha_vencimiento')->nullable();

            $table->string('observacion', 300)->nullable();
            $table->timestamps();

            $table->index('ingreso_id');
        });

        DB::statement("ALTER TABLE ingresos ADD CONSTRAINT ingresos_estado_valido CHECK (estado IN ('borrador','confirmada','anulada'))");
        DB::statement('ALTER TABLE ingreso_detalles ADD CONSTRAINT id_cantidad_positiva CHECK (cantidad > 0)');
        DB::statement('ALTER TABLE ingreso_detalles ADD CONSTRAINT id_costo_no_negativo CHECK (costo_unitario >= 0)');

        // Ahora que existe ingreso_detalles se puede cerrar la referencia.
        Schema::table('capas_existencia', function (Blueprint $table) {
            $table->foreign('ingreso_detalle_id')->references('id')->on('ingreso_detalles');
        });

        Schema::table('consumos_capa', function (Blueprint $table) {
            $table->foreign('salida_detalle_id')->references('id')->on('salida_detalles')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('consumos_capa', fn (Blueprint $t) => $t->dropForeign(['salida_detalle_id']));
        Schema::table('capas_existencia', fn (Blueprint $t) => $t->dropForeign(['ingreso_detalle_id']));

        Schema::dropIfExists('ingreso_detalles');
        Schema::dropIfExists('ingresos');
    }
};
