<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;

/** Caja — envío de dinero de la sede central a las cajas, con recepción (database/sql/cargas/25_envio_fondos.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('25_envio_fondos.sql');
    }

    public function down(): void
    {
        throw new RuntimeException('Esta migración no se revierte: restaure el respaldo si necesita volver atrás.');
    }
};
