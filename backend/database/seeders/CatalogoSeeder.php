<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Producto;
use App\Models\UnidadMedida;
use Illuminate\Database\Seeder;

class CatalogoSeeder extends Seeder
{
    public function run(): void
    {
        $this->unidades();
        $this->categorias();

        // Los productos de ejemplo solo en desarrollo: en producción el catálogo
        // lo carga la institución con sus propios ítems.
        $this->unidadesSolicitantes();

        if (app()->environment('local')) {
            $this->productosDeEjemplo();
            $this->existenciasDeEjemplo();
            $this->solicitantesDeEjemplo();
        }
    }

    private function unidades(): void
    {
        $unidades = [
            ['UND', 'Unidad',      false],
            ['CJA', 'Caja',        false],
            ['PQT', 'Paquete',     false],
            ['RES', 'Resma',       false],
            ['KG',  'Kilogramo',   true],
            ['LT',  'Litro',       true],
            ['MT',  'Metro',       true],
            ['GLN', 'Galón',       true],
        ];

        foreach ($unidades as [$codigo, $nombre, $decimales]) {
            UnidadMedida::updateOrCreate(
                ['codigo' => $codigo],
                ['nombre' => $nombre, 'permite_decimales' => $decimales]
            );
        }
    }

    private function categorias(): void
    {
        $categorias = [
            ['ESCR', 'Material de escritorio',  'Papelería y útiles de oficina'],
            ['LIMP', 'Material de limpieza',    'Insumos de aseo y desinfección'],
            ['COMP', 'Equipos de computación',  'Equipos, partes y consumibles informáticos'],
            ['MOBI', 'Mobiliario',              'Muebles y enseres de oficina'],
            ['HERR', 'Herramientas',            'Herramientas manuales y eléctricas'],
            ['REPU', 'Repuestos',               'Repuestos de vehículos y maquinaria'],
            ['SEGU', 'Seguridad industrial',    'Equipo de protección personal'],
        ];

        foreach ($categorias as [$codigo, $nombre, $descripcion]) {
            Categoria::updateOrCreate(
                ['codigo' => $codigo],
                ['nombre' => $nombre, 'descripcion' => $descripcion]
            );
        }
    }

    /**
     * Saldos iniciales SOLO para desarrollo.
     *
     * Crea la capa de costo además del saldo: con PEPS, existencias sin capa
     * hacen fallar la primera salida — el servicio corta antes de escribir un
     * kardex mentiroso.
     *
     * En producción las existencias nacen de un ingreso o de una toma física.
     */
    private function existenciasDeEjemplo(): void
    {
        $central = \App\Models\Almacen::where('codigo', 'ALM-CEN')->value('id');

        if (! $central) {
            return;
        }

        $saldos = [
            'ESCR-0001' => 45,   'ESCR-0002' => 200,  'ESCR-0003' => 30,
            'LIMP-0001' => 22.5, 'LIMP-0002' => 60,
            'COMP-0001' => 6,    'COMP-0002' => 350,
            'SEGU-0001' => 18,   'SEGU-0002' => 25,
            'HERR-0001' => 4,
        ];

        foreach ($saldos as $codigo => $cantidad) {
            $productoId = Producto::where('codigo', $codigo)->value('id');

            if (! $productoId) {
                continue;
            }

            $costo = round(5 + ($productoId % 7) * 3.5, 2);

            \App\Models\Existencia::updateOrCreate(
                ['producto_id' => $productoId, 'almacen_id' => $central],
                [
                    'cantidad'             => $cantidad,
                    'costo_promedio'       => $costo,
                    'ultimo_movimiento_en' => now(),
                ]
            );

            // La capa correspondiente, o PEPS no tendría de dónde costear.
            \App\Models\CapaExistencia::updateOrCreate(
                ['producto_id' => $productoId, 'almacen_id' => $central, 'ingreso_detalle_id' => null],
                [
                    'fecha'             => now()->subMonth(),
                    'cantidad_inicial'  => $cantidad,
                    'cantidad_restante' => $cantidad,
                    'costo_unitario'    => $costo,
                ]
            );
        }
    }

    /** Unidades típicas de una institución. Se ajustan desde la interfaz. */
    private function unidadesSolicitantes(): void
    {
        $unidades = [
            ['DAF',  'Dirección Administrativa Financiera', '34200'],
            ['DTEC', 'Dirección Técnica',                   '34300'],
            ['ALM',  'Almacenes',                           '34200'],
            ['SG',   'Secretaría General',                  '34200'],
            ['RRHH', 'Recursos Humanos',                    '34200'],
        ];

        foreach ($unidades as [$codigo, $nombre, $centro]) {
            \App\Models\UnidadSolicitante::updateOrCreate(
                ['codigo' => $codigo],
                ['nombre' => $nombre, 'centro_costo' => $centro]
            );
        }
    }

    private function solicitantesDeEjemplo(): void
    {
        $porUnidad = fn (string $codigo) => \App\Models\UnidadSolicitante::where('codigo', $codigo)->value('id');

        $personas = [
            ['DAF',  'Rosa Quispe Mamani',   'Jefa de Contabilidad',   true],
            ['DAF',  'Marco Antonio Vargas', 'Auxiliar administrativo', true],
            ['DTEC', 'Juan Carlos Coro',     'Supervisor de obra',      true],
            ['DTEC', 'Elena Choquehuanca',   'Directora Técnica',       false],
            ['ALM',  'Luis Mamani Flores',   'Auxiliar de almacén',     true],
        ];

        foreach ($personas as [$unidad, $nombre, $cargo, $retira]) {
            \App\Models\Solicitante::updateOrCreate(
                ['unidad_solicitante_id' => $porUnidad($unidad), 'nombre' => $nombre],
                ['cargo' => $cargo, 'autorizado_retirar' => $retira]
            );
        }
    }

    private function productosDeEjemplo(): void
    {
        $porCodigo = fn (string $tabla, string $codigo) => match ($tabla) {
            'cat' => Categoria::where('codigo', $codigo)->value('id'),
            'uni' => UnidadMedida::where('codigo', $codigo)->value('id'),
        };

        $productos = [
            ['ESCR-0001', 'Papel bond tamaño carta 75 g',        'ESCR', 'RES', 10, '34200'],
            ['ESCR-0002', 'Bolígrafo tinta azul',                'ESCR', 'UND', 50, '34200'],
            ['ESCR-0003', 'Archivador de palanca lomo ancho',    'ESCR', 'UND', 20, '34200'],
            ['LIMP-0001', 'Detergente en polvo',                 'LIMP', 'KG',  15, '34600'],
            ['LIMP-0002', 'Lavandina 5 %',                       'LIMP', 'LT',  20, '34600'],
            ['COMP-0001', 'Tóner para impresora láser negro',    'COMP', 'UND',  4, '34300'],
            ['COMP-0002', 'Cable de red UTP categoría 6',        'COMP', 'MT', 100, '34300'],
            ['SEGU-0001', 'Casco de seguridad',                  'SEGU', 'UND', 10, '34800'],
            ['SEGU-0002', 'Guantes de cuero reforzados',         'SEGU', 'PQT', 15, '34800'],
            ['HERR-0001', 'Juego de destornilladores',           'HERR', 'CJA',  3, '43110'],
        ];

        foreach ($productos as [$codigo, $nombre, $cat, $uni, $minimo, $partida]) {
            Producto::updateOrCreate(
                ['codigo' => $codigo],
                [
                    'nombre'                 => $nombre,
                    'categoria_id'           => $porCodigo('cat', $cat),
                    'unidad_medida_id'       => $porCodigo('uni', $uni),
                    'stock_minimo'           => $minimo,
                    'partida_presupuestaria' => $partida,
                    'activo'                 => true,
                ]
            );
        }
    }
}
