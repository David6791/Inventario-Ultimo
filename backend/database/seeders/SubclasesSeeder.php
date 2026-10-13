<?php

namespace Database\Seeders;

use App\Modules\Activos\Models\Clase;
use App\Modules\Activos\Models\Subclase;
use Illuminate\Database\Seeder;

/**
 * Subclases para una empresa de acopio mineral.
 *
 *   php artisan db:seed --class=SubclasesSeeder
 *
 * ──────────────────────────────────────────────────────────────────────────
 * QUÉ ES UNA SUBCLASE Y QUÉ NO
 *
 * La clase viene del Anexo del Art. 22 y fija la vida útil FISCAL. La subclase
 * la define la empresa y existe por dos razones:
 *
 *   · Separa el correlativo. La primera laptop es 05-02-000001 y la primera
 *     impresora 05-03-000001: el número dice qué es el bien.
 *
 *   · Permite estimar la vida útil ECONÓMICA. Un servidor y una tablet tienen
 *     la misma vida fiscal —4 años— pero no duran lo mismo en la realidad.
 *
 * Donde la vida económica coincide con la fiscal, se deja en null y se hereda.
 * Solo se declara cuando hay una razón técnica para que difiera.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ESTE SEEDER ES UN PUNTO DE PARTIDA
 *
 * Las subclases reflejan cómo la empresa organiza sus bienes, así que conviene
 * revisarlas con quien maneja el inventario. Sobran las que no se usen —una
 * subclase sin bienes no molesta— pero faltar obliga a clasificar mal.
 */
class SubclasesSeeder extends Seeder
{
    /**
     * clase => [ [código, nombre, vida útil económica en meses o null], ... ]
     *
     * La vida económica se declara solo cuando difiere de la fiscal y hay
     * fundamento para ello.
     */
    private const SUBCLASES = [

        '01' => [   // Terrenos — no deprecian
            ['01', 'Terreno urbano', null],
            ['02', 'Terreno industrial', null],
            ['03', 'Concesión minera', null],
        ],

        '02' => [   // Edificaciones — 40 años fiscal
            ['01', 'Oficinas administrativas', null],
            ['02', 'Galpón de acopio', null],
            ['03', 'Laboratorio', null],
            ['04', 'Obras civiles y plataformas', 240],   // 20 años: intemperie
            ['05', 'Cerco perimetral', 240],
        ],

        '03' => [   // Muebles y enseres — 10 años fiscal
            ['01', 'Escritorios y sillas', null],
            ['02', 'Estantes y archivadores', null],
            ['03', 'Mobiliario de laboratorio', null],
            ['04', 'Caja fuerte', null],
        ],

        '04' => [   // Equipos e instalaciones — 8 años fiscal
            ['01', 'Balanzas industriales', null],
            ['02', 'Equipos de laboratorio', 60],         // 5 años: uso intensivo
            ['03', 'Instalación eléctrica', null],
            ['04', 'Grupo electrógeno', null],
            ['05', 'Equipos de aire comprimido', null],
            ['06', 'Sistema de videovigilancia', 48],     // 4 años: electrónica
            ['07', 'Equipos de comunicación', 60],
        ],

        '05' => [   // Equipos de computación — 4 años fiscal
            ['01', 'Computadoras de escritorio', null],
            ['02', 'Computadoras portátiles', null],
            ['03', 'Impresoras y escáneres', 60],         // 5 años: duran más
            ['04', 'Servidores', 72],                     // 6 años: gama alta
            ['05', 'Equipos de red', 72],
            ['06', 'UPS y respaldo de energía', 60],
            ['07', 'Tablets y dispositivos móviles', 36], // 3 años: campo
        ],

        '06' => [   // Maquinaria en general — 8 años fiscal
            ['01', 'Chancadora', null],
            ['02', 'Molino', null],
            ['03', 'Zaranda y clasificadora', null],
            ['04', 'Bomba industrial', 72],
            ['05', 'Compresora', null],
            ['06', 'Soldadora', 72],
        ],

        '07' => [   // Maquinaria para la construcción — 5 años fiscal
            ['01', 'Excavadora', 120],                    // 10 años con mantenimiento
            ['02', 'Cargador frontal', 120],
            ['03', 'Retroexcavadora', 120],
            ['04', 'Motoniveladora', 120],
            ['05', 'Mezcladora y menores', null],
        ],

        '08' => [   // Vehículos automotores — 5 años fiscal
            ['01', 'Camioneta', 96],                      // 8 años: uso real
            ['02', 'Camión volquete', 120],
            ['03', 'Camión cisterna', 120],
            ['04', 'Minibús y transporte de personal', 96],
            ['05', 'Motocicleta', 60],
        ],

        '09' => [   // Herramientas — 4 años fiscal
            ['01', 'Herramienta eléctrica', null],
            ['02', 'Herramienta manual', null],
            ['03', 'Equipo de medición', 60],
            ['04', 'Equipo de seguridad industrial', 36],
        ],

        '13' => [   // Silos, almacenes y galpones — 20 años fiscal
            ['01', 'Silo de almacenamiento', null],
            ['02', 'Depósito de insumos', null],
            ['03', 'Cancha de acopio', 120],              // 10 años: desgaste
        ],

        '14' => [   // Viviendas para el personal — 20 años fiscal
            ['01', 'Campamento', null],
            ['02', 'Vivienda de supervisión', null],
        ],

        '15' => [   // Muebles en viviendas — 10 años fiscal
            ['01', 'Mobiliario de campamento', null],
            ['02', 'Electrodomésticos', 60],
        ],

        '18' => [   // Alambrados y vallas — 10 años fiscal
            ['01', 'Cerco de malla', null],
            ['02', 'Portón y tranquera', null],
        ],

        '20' => [   // Tinglados de metal — 20 años fiscal
            ['01', 'Tinglado de carga', null],
            ['02', 'Cobertizo de maquinaria', null],
        ],

        '21' => [   // Electrificación rural — 10 años fiscal
            ['01', 'Línea eléctrica', null],
            ['02', 'Transformador', null],
            ['03', 'Panel solar', 120],
            ['04', 'Enlace de radio', 60],
        ],

        '22' => [   // Caminos interiores — 10 años fiscal
            ['01', 'Camino de acceso', null],
            ['02', 'Playa de maniobras', null],
        ],

        '99' => [   // Bienes de control — van a gasto, no se deprecian
            ['01', 'Equipos menores', null],
            ['02', 'Herramienta menor', null],
            ['03', 'Mobiliario menor', null],
        ],
    ];

    public function run(): void
    {
        $creadas = 0;
        $existentes = 0;
        $sinClase = [];

        foreach (self::SUBCLASES as $codigoClase => $subclases) {
            $clase = Clase::where('codigo', $codigoClase)->first();

            if (! $clase) {
                $sinClase[] = $codigoClase;
                continue;
            }

            foreach ($subclases as [$codigo, $nombre, $vidaEconomica]) {
                $subclase = Subclase::firstOrCreate(
                    ['clase_id' => $clase->id, 'codigo' => $codigo],
                    [
                        'nombre'                    => $nombre,
                        'vida_util_economica_meses' => $vidaEconomica,
                        'activo'                    => true,
                    ]
                );

                $subclase->wasRecentlyCreated ? $creadas++ : $existentes++;
            }
        }

        $this->command->info('');
        $this->command->info('  Subclases');
        $this->command->info('  ─────────');
        $this->command->info("  Creadas:     {$creadas}");
        $this->command->info("  Ya existían: {$existentes}");

        if (! empty($sinClase)) {
            $this->command->warn('  Clases no encontradas: ' . implode(', ', $sinClase));
        }

        $this->command->info('');
        $this->command->line('  Las clases 10, 11, 12, 16, 17, 19, 23 y 24 quedaron sin subclases:');
        $this->command->line('  son agropecuarias, náuticas o aéreas. Si la empresa tiene bienes');
        $this->command->line('  de esas categorías, créelas desde la pantalla de subclases.');
        $this->command->info('');
    }
}
