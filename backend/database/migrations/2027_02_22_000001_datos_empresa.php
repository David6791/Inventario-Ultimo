<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Datos de la empresa que salen en documentos, reportes y la pantalla de
 * ingreso: nombre, una línea de detalle (NIT, dirección), logo y marca de
 * agua. Una sola fila; se arranca con el nombre que hoy tiene el .env.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE comun.empresa (
                id                  smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
                nombre              varchar(120) NOT NULL CHECK (btrim(nombre) <> ''),
                subtitulo           varchar(200),
                logo_path           varchar(200),
                marca_agua_path     varchar(200),
                marca_agua_opacidad numeric(3,2) NOT NULL DEFAULT 0.08 CHECK (marca_agua_opacidad BETWEEN 0.02 AND 0.50),
                actualizado_por     bigint REFERENCES public.users(id),
                updated_at          timestamp(0)
            )
        SQL);
        DB::statement("COMMENT ON TABLE comun.empresa IS 'Nombre, logo y marca de agua de documentos y reportes. Una sola fila (id = 1).'");

        DB::table('comun.empresa')->insert([
            'id'         => 1,
            'nombre'     => config('app.empresa') ?: config('app.name') ?: 'Empresa',
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS comun.empresa');
    }
};
