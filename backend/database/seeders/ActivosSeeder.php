<?php

namespace Database\Seeders;

use App\Modules\Activos\Models\Clase;
use App\Modules\Activos\Models\Subclase;
use App\Modules\Activos\Models\Ubicacion;
use Illuminate\Database\Seeder;

/**
 * Las clases y los parámetros ya vienen cargados por el DDL.
 * Este seeder agrega subclases de arranque y ubicaciones de ejemplo.
 *
 *   php artisan db:seed --class=ActivosSeeder
 */
class ActivosSeeder extends Seeder
{
    public function run(): void
    {
        $this->subclases();
        $this->ubicacionesEjemplo();
    }

    private function subclases(): void
    {
        // [código de clase => [ [código, nombre, vida útil económica en meses], ... ]]
        $mapa = [
            '02' => [['01', 'Edificio administrativo', 480],
                     ['02', 'Galpón industrial', 480],
                     ['03', 'Obra civil complementaria', 480]],
            '03' => [['01', 'Escritorios y sillas', 120],
                     ['02', 'Archivadores y estantes', 120],
                     ['03', 'Mobiliario de recepción', 120]],
            '04' => [['01', 'Aire acondicionado', 96],
                     ['02', 'Equipos de seguridad y CCTV', 96],
                     ['03', 'Instalaciones eléctricas', 96]],
            '05' => [['01', 'Computadoras de escritorio', 48],
                     ['02', 'Computadoras portátiles', 48],
                     ['03', 'Impresoras y multifuncionales', 48],
                     ['04', 'Servidores', 60],
                     ['05', 'Equipos de red', 60]],
            '06' => [['01', 'Maquinaria de producción', 96],
                     ['02', 'Equipos de laboratorio', 96]],
            '08' => [['01', 'Camionetas', 60],
                     ['02', 'Automóviles', 60],
                     ['03', 'Camiones', 60],
                     ['04', 'Motocicletas', 60]],
            '09' => [['01', 'Herramientas eléctricas', 48],
                     ['02', 'Herramientas manuales', 48]],
            '99' => [['01', 'Accesorios informáticos', null],
                     ['02', 'Herramientas menores', null],
                     ['03', 'Equipos de comunicación menores', null]],
        ];

        foreach ($mapa as $codigoClase => $subclases) {
            $clase = Clase::where('codigo', $codigoClase)->first();

            if (! $clase) {
                $this->command->warn("Clase {$codigoClase} no encontrada. ¿Se ejecutó la migración?");
                continue;
            }

            foreach ($subclases as [$codigo, $nombre, $vidaUtil]) {
                Subclase::updateOrCreate(
                    ['clase_id' => $clase->id, 'codigo' => $codigo],
                    ['nombre' => $nombre, 'vida_util_economica_meses' => $vidaUtil, 'activo' => true]
                );
            }
        }

        $this->command->info('Subclases cargadas.');
    }

    private function ubicacionesEjemplo(): void
    {
        if (Ubicacion::exists()) {
            $this->command->info('Ya hay ubicaciones cargadas. Se omite el ejemplo.');
            return;
        }

        $central = Ubicacion::create([
            'codigo' => 'OC', 'nombre' => 'Oficina Central', 'activo' => true,
        ]);

        foreach ([
            ['OC-P1', 'Planta baja'],
            ['OC-P2', 'Primer piso'],
            ['OC-DEP', 'Depósito'],
        ] as [$codigo, $nombre]) {
            Ubicacion::create([
                'codigo' => $codigo, 'nombre' => $nombre,
                'padre_id' => $central->id, 'activo' => true,
            ]);
        }

        $this->command->info('Ubicaciones de ejemplo cargadas. Reemplazar por las reales.');
    }
}
