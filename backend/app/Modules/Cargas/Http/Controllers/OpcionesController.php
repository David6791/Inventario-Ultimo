<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Models\Elemento;
use App\Modules\Cargas\Models\LineaProducto;
use App\Modules\Cargas\Models\LineaProductoElemento;
use App\Modules\Cargas\Models\Municipio;
use App\Modules\Cargas\Models\Productor;
use App\Modules\Cargas\Models\SerieLote;
use Illuminate\Http\JsonResponse;

/**
 * Listas cerradas para los desplegables. Salen de las constantes de los
 * modelos (que copian los CHECK de la base), así el frontend no las repite.
 */
class OpcionesController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $lista = fn (array $valores) => array_map(fn ($v) => ['valor' => $v, 'etiqueta' => $this->etiqueta($v)], $valores);
        $mapa  = fn (array $pares) => array_map(fn ($v, $e) => ['valor' => $v, 'etiqueta' => $e], array_keys($pares), $pares);

        return response()->json(['data' => [
            'tipos_productor'     => $lista(Productor::TIPOS),
            'departamentos'       => $lista(Municipio::DEPARTAMENTOS),
            'unidades_ley'        => $mapa(Elemento::UNIDADES_LEY),
            'unidades_cotizacion' => $mapa(Elemento::UNIDADES_COTIZACION),
            'formas'              => $lista(LineaProducto::FORMAS),
            'modalidades_precio'  => $mapa(LineaProducto::MODALIDADES),
            'roles_elemento'      => $lista(LineaProductoElemento::ROLES),
            'origenes'            => [
                ['valor' => 'COMPRA', 'etiqueta' => 'Compra a productores'],
                ['valor' => 'PROPIA', 'etiqueta' => 'Producción propia (bocaminas)'],
            ],
            'reinicios' => [
                ['valor' => 'NUNCA',   'etiqueta' => 'Nunca (correlativo continuo)'],
                ['valor' => 'ANUAL',   'etiqueta' => 'Cada año'],
                ['valor' => 'MENSUAL', 'etiqueta' => 'Cada mes'],
                ['valor' => 'DIARIO',  'etiqueta' => 'Cada día'],
            ],
            'marcadores' => $mapa(SerieLote::MARCADORES),
        ]]);
    }

    private function etiqueta(string $valor): string
    {
        return match ($valor) {
            'POTOSI' => 'Potosí',
            default  => mb_convert_case(mb_strtolower($valor), MB_CASE_TITLE),
        };
    }
}
