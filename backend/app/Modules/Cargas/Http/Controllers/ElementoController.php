<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\ElementoRequest;
use App\Modules\Cargas\Models\Elemento;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ElementoController extends Controller
{
    /** Cada elemento indica si ya tiene datos: con datos, su unidad de ley queda fija. */
    public function index(): JsonResponse
    {
        $elementos = Elemento::query()
            ->select('cargas.elemento.*')
            ->selectRaw(<<<'SQL'
                (exists (select 1 from cargas.analisis_resultado r where r.elemento_id = cargas.elemento.id)
                 or exists (select 1 from cargas.lote_ley l where l.elemento_id = cargas.elemento.id)
                 or exists (select 1 from cargas.tabla_precio t where t.elemento_id = cargas.elemento.id)
                 or exists (select 1 from cargas.cotizacion c where c.elemento_id = cargas.elemento.id)) as unidad_fija
            SQL)
            ->orderByRaw("codigo = 'H2O' desc, codigo")
            ->get();

        return response()->json(['data' => $elementos]);
    }

    public function store(ElementoRequest $request): JsonResponse
    {
        $elemento = Transaccion::delUsuarioActual(fn () => Elemento::create($request->validated()));

        return response()->json(['data' => $elemento->refresh()], 201);
    }

    public function update(ElementoRequest $request, Elemento $elemento): JsonResponse
    {
        Transaccion::delUsuarioActual(fn () => $elemento->update($request->validated()));

        return response()->json(['data' => $elemento->refresh()]);
    }
}
