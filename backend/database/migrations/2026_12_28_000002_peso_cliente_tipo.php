<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;

/** Peso del cliente bruto o neto y su corrección con motivo (database/sql/cargas/15_peso_cliente.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('15_peso_cliente.sql');
    }

    public function down(): void
    {
        // Sin vuelta atrás automática: la vista y el control de pesajes de 12_ quedaron reemplazados.
    }
};
