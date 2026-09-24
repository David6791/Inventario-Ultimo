<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\UnidadMedida;
use Illuminate\Database\Seeder;

/**
 * Catálogo base: unidades de medida y categorías.
 *
 * Es lo ÚNICO que conviene sembrar en un despliegue real. No son datos de
 * ejemplo: son clasificaciones estándar que cualquier almacén necesita antes
 * de poder cargar el primer producto.
 *
 * Todo lo demás —productos, existencias, solicitantes— lo carga la institución
 * con sus propios datos. Sembrarlo obligaría a limpiarlo después a mano, y
 * mezclado con lo real es difícil distinguir qué sobra.
 *
 *   php artisan db:seed --class=CatalogoBaseSeeder
 *
 * Se puede volver a correr sin problema: usa updateOrCreate, así que no
 * duplica ni pisa lo que usted haya modificado en los códigos existentes.
 */
class CatalogoBaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->unidades();
        $this->categorias();

        $this->command?->info('Catálogo base listo: unidades de medida y categorías.');
    }

    /**
     * `permite_decimales` decide si el sistema acepta cantidades fraccionarias.
     *
     * Media resma de papel no existe; medio kilo de detergente sí. Marcarlo
     * mal permite registrar "2,5 caretas de seguridad", que después nadie sabe
     * cómo contar en una toma física.
     */
    private function unidades(): void
    {
        $unidades = [
            // código, nombre, admite decimales
            ['UND', 'Unidad',      false],
            ['PZA', 'Pieza',       false],
            ['CJA', 'Caja',        false],
            ['PQT', 'Paquete',     false],
            ['RES', 'Resma',       false],
            ['JGO', 'Juego',       false],
            ['PAR', 'Par',         false],
            ['ROL', 'Rollo',       false],
            ['BOL', 'Bolsa',       false],
            ['FCO', 'Frasco',      false],
            ['BID', 'Bidón',       false],
            ['VAL', 'Balde',       false],
            ['TAM', 'Turril',      false],

            ['KG',  'Kilogramo',   true],
            ['GR',  'Gramo',       true],
            ['TN',  'Tonelada',    true],
            ['LT',  'Litro',       true],
            ['ML',  'Mililitro',   true],
            ['GLN', 'Galón',       true],
            ['MT',  'Metro',       true],
            ['M2',  'Metro cuadrado', true],
            ['M3',  'Metro cúbico',   true],
            ['CM',  'Centímetro',  true],
        ];

        foreach ($unidades as [$codigo, $nombre, $decimales]) {
            UnidadMedida::updateOrCreate(
                ['codigo' => $codigo],
                ['nombre' => $nombre, 'permite_decimales' => $decimales]
            );
        }
    }

    /**
     * Categorías de uso común en un almacén institucional.
     *
     * Sirven de punto de partida: agregue, renombre o dé de baja las que no
     * correspondan desde Catálogos → Clasificación.
     */
    private function categorias(): void
    {
        $categorias = [
            ['ESCR', 'Material de escritorio',   'Papelería y útiles de oficina'],
            ['LIMP', 'Material de limpieza',     'Insumos de aseo y desinfección'],
            ['COMP', 'Equipos de computación',   'Equipos, partes y consumibles informáticos'],
            ['MOBI', 'Mobiliario',               'Muebles y enseres de oficina'],
            ['HERR', 'Herramientas',             'Herramientas manuales y eléctricas'],
            ['REPU', 'Repuestos',                'Repuestos de vehículos y maquinaria'],
            ['SEGU', 'Seguridad industrial',     'Equipo de protección personal'],
            ['CONS', 'Material de construcción', 'Cemento, áridos, fierro y afines'],
            ['ELEC', 'Material eléctrico',       'Conductores, accesorios y luminarias'],
            ['COMB', 'Combustibles y lubricantes', 'Diésel, gasolina, grasas y aceites'],
            ['MEDI', 'Insumos médicos',          'Botiquín y material de primeros auxilios'],
            ['VARI', 'Varios',                   'Ítems que no encajan en otra categoría'],
        ];

        foreach ($categorias as [$codigo, $nombre, $descripcion]) {
            Categoria::updateOrCreate(
                ['codigo' => $codigo],
                ['nombre' => $nombre, 'descripcion' => $descripcion]
            );
        }
    }
}
