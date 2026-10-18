<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * GET api/cargas/estado — comprobación de que el despliegue quedó completo:
 * esquemas con sus tablas y vistas, catálogo inicial cargado y el próximo
 * código de cada serie (vista previa, no consume números).
 */
class EstadoController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $esquemas = DB::select(<<<'SQL'
            select n.nspname as esquema,
                   count(c.oid) filter (where c.relkind = 'r') as tablas,
                   count(c.oid) filter (where c.relkind = 'v') as vistas
              from pg_namespace n
              left join pg_class c on c.relnamespace = n.oid
             where n.nspname in ('comun', 'caja', 'cargas')
             group by n.nspname
             order by n.nspname
        SQL);

        $catalogo = DB::selectOne(<<<'SQL'
            select (select count(*) from cargas.elemento)           as elementos,
                   (select count(*) from cargas.linea_producto)     as lineas,
                   (select count(*) from cargas.serie_lote)         as series,
                   (select count(*) from cargas.retencion_concepto) as retenciones,
                   (select count(*) from caja.concepto)             as conceptos_caja
        SQL);

        $series = DB::select(<<<'SQL'
            select s.prefijo, s.formato, s.reinicio,
                   cargas.vista_previa_codigo_lote(s.id, current_date) as proximo_codigo
              from cargas.serie_lote s
             where s.activa
             order by s.prefijo
        SQL);

        return response()->json([
            'esquemas' => $esquemas,
            'catalogo' => $catalogo,
            'series'   => $series,
        ]);
    }
}
