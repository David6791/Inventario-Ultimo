<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Enums\Permisos;
use App\Http\Controllers\Controller;
use App\Models\Almacen;
use App\Models\User;
use App\Modules\Cargas\Services\SedeRecepcionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Sedes de recepción y quiénes reciben en cada una (como los cajeros de una caja). */
class SedeRecepcionController extends Controller
{
    public function __construct(private readonly SedeRecepcionService $sedes)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $candidatos = $request->user()->can('cargas.catalogos')
            ? User::query()->where('activo', true)
                ->where(fn ($q) => $q->permission(['cargas.recibir'])
                    ->orWhereHas('roles', fn ($r) => $r->where('name', Permisos::SUPER_ADMIN)))
                ->orderBy('name')->get(['id', 'name', 'email'])
            : [];

        return response()->json(['data' => $this->sedes->listado(), 'candidatos' => $candidatos]);
    }

    public function update(Request $request, Almacen $almacen): JsonResponse
    {
        abort_unless($request->user()->can('cargas.catalogos'), 403, 'Su usuario no puede asignar recepcionistas.');
        $datos = $request->validate([
            'usuarios'   => ['present', 'array', 'max:50'],
            'usuarios.*' => ['integer', Rule::exists('users', 'id')->where('activo', true)],
        ]);
        $this->sedes->asignar($almacen->id, $datos['usuarios']);

        $sede = collect($this->sedes->listado())->firstWhere('id', $almacen->id);
        $n = count($datos['usuarios']);

        return response()->json(['data' => $sede, 'mensaje' => $n
            ? "Sede {$almacen->nombre}: " . ($n === 1 ? 'un recepcionista' : "{$n} recepcionistas") . '. Solo ellos reciben carga ahí.'
            : "Sede {$almacen->nombre} sin recepcionistas: recibe quien tenga acceso a la sede."]);
    }
}
