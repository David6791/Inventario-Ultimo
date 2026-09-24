<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Acumulado devuelto por consumo. Evita recalcular con un SUM() cada vez
     * que hay que saber cuanto queda devolvible de esa capa.
     */
    public function up(): void
    {
        Schema::table('consumos_capa', function (Blueprint $tabla) {
            $tabla->decimal('cantidad_devuelta', 14, 4)->default(0)->after('cantidad');
        });

        Schema::table('salida_detalles', function (Blueprint $tabla) {
            $tabla->decimal('cantidad_devuelta', 14, 4)->default(0)->after('cantidad');
        });
    }

    public function down(): void
    {
        Schema::table('salida_detalles', function (Blueprint $tabla) {
            $tabla->dropColumn('cantidad_devuelta');
        });

        Schema::table('consumos_capa', function (Blueprint $tabla) {
            $tabla->dropColumn('cantidad_devuelta');
        });
    }
};
