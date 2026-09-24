<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Corre DESPUÉS de la migración de spatie/laravel-permission.
 * Verificar que el timestamp de este archivo sea posterior al de
 * `create_permission_tables.php` publicado por el paquete.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->string('descripcion', 200)->nullable()->after('guard_name');

            // Los roles de sistema no se pueden eliminar ni renombrar desde la UI.
            $table->boolean('es_sistema')->default(false)->after('descripcion');
        });
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn(['descripcion', 'es_sistema']);
        });
    }
};
