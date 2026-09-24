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
        | Capas de costo — el corazón de PEPS.
        |
        | Cada ingreso crea una capa con su cantidad y su precio. Las salidas las
        | consumen por antigüedad. `cantidad_restante` baja hasta cero y ahí la
        | capa queda agotada, pero no se borra: el histórico de costos tiene que
        | poder reconstruirse.
        |
        | La tabla `existencias` sigue existiendo como saldo rápido, pero la
        | verdad del costo está acá. Si los dos no coinciden, mandan las capas.
        */
        Schema::create('capas_existencia', function (Blueprint $table) {
            $table->id();
            $table->foreignId('producto_id')->constrained('productos');
            $table->foreignId('almacen_id')->constrained('almacenes');

            // De qué ingreso vino. Nullable para el saldo inicial de una toma
            // física, que no tiene documento de compra detrás.
            $table->unsignedBigInteger('ingreso_detalle_id')->nullable();

            // Orden de consumo. Se usa la fecha del documento, no la del
            // registro: si se carga con atraso, igual entra en su lugar.
            $table->timestamp('fecha');

            $table->decimal('cantidad_inicial', 14, 4);
            $table->decimal('cantidad_restante', 14, 4);
            $table->decimal('costo_unitario', 14, 4);

            $table->string('lote', 60)->nullable();
            $table->date('fecha_vencimiento')->nullable();

            $table->timestamps();

            // El índice que resuelve "dame las capas vivas más antiguas".
            $table->index(['producto_id', 'almacen_id', 'fecha']);
            $table->index('ingreso_detalle_id');
        });

        DB::statement('ALTER TABLE capas_existencia ADD CONSTRAINT capa_restante_valido CHECK (cantidad_restante >= 0 AND cantidad_restante <= cantidad_inicial)');
        DB::statement('ALTER TABLE capas_existencia ADD CONSTRAINT capa_inicial_positiva CHECK (cantidad_inicial > 0)');

        /*
        | Qué capa consumió cada línea de salida.
        |
        | Una línea puede tocar varias capas: si salen 15 y la más vieja tiene
        | 10, se consume esa y 5 de la siguiente, a precios distintos. Sin este
        | detalle no se puede anular una salida sin descuadrar el costeo, ni
        | explicar en una auditoría cómo se valorizó.
        */
        Schema::create('consumos_capa', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('salida_detalle_id');
            $table->foreignId('capa_id')->constrained('capas_existencia');

            $table->decimal('cantidad', 14, 4);
            $table->decimal('costo_unitario', 14, 4);

            $table->timestamps();

            $table->index('salida_detalle_id');
        });

        DB::statement('ALTER TABLE consumos_capa ADD CONSTRAINT consumo_cantidad_positiva CHECK (cantidad > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('consumos_capa');
        Schema::dropIfExists('capas_existencia');
    }
};
