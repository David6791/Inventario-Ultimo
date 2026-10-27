<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Models\Elemento;
use App\Modules\Cargas\Models\LineaProducto;
use App\Modules\Cargas\Models\LineaProductoElemento;
use App\Modules\Cargas\Models\Municipio;
use App\Modules\Cargas\Models\Productor;
use App\Modules\Cargas\Models\SerieLote;
use App\Models\Almacen;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Listas cerradas para los desplegables. Salen de las constantes de los
 * modelos (que copian los CHECK de la base), así el frontend no las repite.
 */
class OpcionesController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $usuario = $request->user();
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
            'estados_lote' => $lista(\App\Modules\Cargas\Models\Lote::ESTADOS),
            'materiales'   => array_map(fn ($m) => ['valor' => $m, 'etiqueta' => $m], \App\Modules\Cargas\Models\Lote::MATERIALES),
            // Sedes donde el usuario puede recibir (la predeterminada primero).
            'almacenes' => Almacen::query()->where('activo', true)
                ->when(! $usuario->can('cargas.ver-todos-almacenes'), fn ($q) => $q->whereIn('id', $usuario->almacenesIds()))
                ->orderBy('nombre')->get(['id', 'codigo', 'nombre']),
            'almacen_predeterminado' => $usuario->almacenPredeterminado()?->id,
            'foto_ticket_obligatoria' => \App\Modules\Cargas\Http\Requests\PesajeRequest::fotoObligatoria(),
            // Dónde recibe carga este usuario (con una sola asignada, el formulario no pide sede).
            'sedes_recepcion' => app(\App\Modules\Cargas\Services\SedeRecepcionService::class)->sedesDe($usuario),
            'sede_recepcion_fija' => app(\App\Modules\Cargas\Services\SedeRecepcionService::class)->sedeFija($usuario),
            'limite_promedio_peso_kg' => (float) (app(\App\Modules\Cargas\Services\ParametroService::class)
                ->vigente('LIMITE_PROMEDIO_PESO_KG')?->valor ?? 100),
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
