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
        | Kardex: el histórico de movimientos por producto y almacén.
        |
        | Es la fuente de verdad de la que se puede reconstruir `existencias`.
        | Si alguna vez los dos no coinciden, manda el kardex.
        |
        | Nunca se actualiza ni se borra una fila: una anulación escribe un
        | movimiento inverso. Así la historia queda completa y una auditoría
        | puede seguir el rastro.
        */
        Schema::create('kardex', function (Blueprint $table) {
            $table->id();
            $table->foreignId('producto_id')->constrained('productos');
            $table->foreignId('almacen_id')->constrained('almacenes');

            $table->timestamp('fecha');
            $table->string('tipo', 20);   // ingreso, salida, ajuste, transferencia

            // Documento que originó el movimiento. Polimórfico simple: guardar
            // el número como texto mantiene el rastro aunque el documento
            // cambie de tabla en el futuro.
            $table->string('documento_tipo', 30);
            $table->unsignedBigInteger('documento_id');
            $table->string('documento_numero', 40);

            $table->decimal('entrada', 14, 4)->default(0);
            $table->decimal('salida', 14, 4)->default(0);

            // Saldo DESPUÉS de este movimiento. Se guarda en vez de calcularse
            // para que el reporte de kardex no tenga que sumar toda la historia
            // en cada consulta.
            $table->decimal('saldo', 14, 4);

            $table->decimal('costo_unitario', 14, 4)->default(0);
            $table->decimal('costo_total', 14, 4)->default(0);

            $table->foreignId('registrado_por')->constrained('users');
            $table->string('observacion', 300)->nullable();
            $table->timestamps();

            $table->index(['producto_id', 'almacen_id', 'fecha']);
            $table->index(['documento_tipo', 'documento_id']);
            $table->index('fecha');
        });

        DB::statement('ALTER TABLE kardex ADD CONSTRAINT kardex_un_solo_sentido CHECK ((entrada > 0 AND salida = 0) OR (salida > 0 AND entrada = 0))');
    }

    public function down(): void
    {
        Schema::dropIfExists('kardex');
    }
};
