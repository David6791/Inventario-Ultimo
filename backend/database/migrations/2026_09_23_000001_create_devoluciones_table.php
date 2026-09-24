<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('devoluciones', function (Blueprint $tabla) {
            $tabla->id();
            $tabla->string('numero', 30)->unique();
            $tabla->unsignedSmallInteger('gestion');
            $tabla->date('fecha');

            // Toda devolucion nace de una salida: es lo que permite valorizarla
            // al costo de las capas que esa salida consumio.
            $tabla->foreignId('salida_id')->constrained('salidas');
            $tabla->foreignId('almacen_id')->constrained('almacenes');
            $tabla->foreignId('solicitante_id')->nullable()->constrained('solicitantes')->nullOnDelete();
            $tabla->foreignId('unidad_solicitante_id')->nullable()->constrained('unidades_solicitantes')->nullOnDelete();

            // Snapshots de texto: renombrar una unidad no debe alterar el historico.
            $tabla->string('solicitante_nombre', 165)->nullable();
            $tabla->string('unidad_nombre', 150)->nullable();
            $tabla->string('salida_numero', 30);

            $tabla->string('motivo', 40);   // sobrante | no_correspondia | defectuoso | cambio_requerimiento | otro
            $tabla->decimal('costo_total', 14, 2)->default(0);
            $tabla->unsignedInteger('cantidad_lineas')->default(0);

            $tabla->string('estado', 20)->default('registrada'); // registrada | anulada
            $tabla->string('motivo_anulacion', 255)->nullable();
            $tabla->text('observaciones')->nullable();

            $tabla->string('pdf_path', 255)->nullable();
            $tabla->boolean('nota_firmada')->default(false);
            $tabla->foreignId('usuario_id')->constrained('users');
            $tabla->timestamps();

            $tabla->index(['fecha', 'estado']);
            $tabla->index('salida_id');
            $tabla->index(['unidad_solicitante_id', 'fecha']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devoluciones');
    }
};
