<?php

namespace Database\Seeders;

use App\Models\Almacen;
use Illuminate\Database\Seeder;

class AlmacenSeeder extends Seeder
{
    public function run(): void
    {
        $almacenes = [
            ['codigo' => 'ALM-CEN', 'nombre' => 'Almacén Central',        'ubicacion' => 'Edificio principal, planta baja'],
            ['codigo' => 'ALM-SUM', 'nombre' => 'Almacén de Suministros', 'ubicacion' => 'Bloque B'],
            ['codigo' => 'ALM-ACT', 'nombre' => 'Almacén de Activos Fijos','ubicacion' => 'Depósito externo'],
        ];

        foreach ($almacenes as $almacen) {
            Almacen::updateOrCreate(['codigo' => $almacen['codigo']], $almacen);
        }
    }
}
