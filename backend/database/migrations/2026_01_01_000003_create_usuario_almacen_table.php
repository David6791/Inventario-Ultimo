<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('usuario_almacen', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('almacen_id')->constrained('almacenes')->cascadeOnDelete();
            $table->boolean('es_predeterminado')->default(false);
            $table->timestamps();

            $table->unique(['user_id', 'almacen_id']);
            $table->index('almacen_id');
        });

        // Un solo almacén predeterminado por usuario. La restricción vive en la
        // base de datos porque la lógica de aplicación no basta con dos requests
        // concurrentes.
        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX usuario_almacen_predeterminado_unico
            ON usuario_almacen (user_id)
            WHERE es_predeterminado = true
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('usuario_almacen');
    }
};
