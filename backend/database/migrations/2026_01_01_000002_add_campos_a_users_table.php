<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('ci', 20)->nullable()->unique()->after('id');
            $table->string('cargo', 120)->nullable()->after('email');
            $table->string('telefono', 30)->nullable()->after('cargo');
            $table->boolean('activo')->default(true)->after('telefono');
            $table->boolean('debe_cambiar_clave')->default(false)->after('activo');
            $table->timestamp('ultimo_acceso_en')->nullable()->after('debe_cambiar_clave');
            $table->softDeletes();

            $table->index('activo');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn([
                'ci', 'cargo', 'telefono', 'activo',
                'debe_cambiar_clave', 'ultimo_acceso_en',
            ]);
        });
    }
};
