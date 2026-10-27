<?php

namespace App\Modules\Cargas\Services;

use App\Models\Almacen;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Sedes donde cada persona recibe carga, como las cajas con sus cajeros:
 *  - Una sede con recepcionistas asignados solo la usan ellos.
 *  - Quien tiene sedes asignadas recibe solo en esas (con una sola, el
 *    formulario ni la pide).
 *  - Quien no tiene ninguna asignada usa las sedes a las que tiene acceso y
 *    que no tienen recepcionistas propios.
 *  - Quien ve todas las sedes (cargas.ver-todos-almacenes) puede recibir en
 *    cualquiera, para cubrir ausencias.
 */
class SedeRecepcionService
{
    /** @return Collection<int, Almacen> */
    public function sedesDe(User $u): Collection
    {
        $activas = Almacen::query()->where('activo', true)->orderBy('nombre');
        if ($u->can('cargas.ver-todos-almacenes')) {
            return $activas->get(['id', 'codigo', 'nombre']);
        }

        $asignadas = $this->asignadasA($u);
        if ($asignadas) {
            return $activas->whereIn('id', $asignadas)->get(['id', 'codigo', 'nombre']);
        }

        $conRecepcionistas = DB::table('cargas.sede_recepcionista')->distinct()->pluck('almacen_id')->all();

        return $activas->whereIn('id', $u->almacenesIds())
            ->when($conRecepcionistas, fn ($q) => $q->whereNotIn('id', $conRecepcionistas))
            ->get(['id', 'codigo', 'nombre']);
    }

    /** La sede fija de quien tiene exactamente una asignada (el formulario no la pide). */
    public function sedeFija(User $u): ?int
    {
        $asignadas = $this->asignadasA($u);

        return count($asignadas) === 1 ? $asignadas[0] : null;
    }

    public function puedeRecibirEn(User $u, int $almacenId): bool
    {
        return $this->sedesDe($u)->contains('id', $almacenId);
    }

    /** @return list<int> */
    private function asignadasA(User $u): array
    {
        return DB::table('cargas.sede_recepcionista')->where('user_id', $u->id)->orderBy('almacen_id')
            ->pluck('almacen_id')->map(fn ($id) => (int) $id)->all();
    }

    /** Sedes activas con sus recepcionistas, para la pantalla de configuración. */
    public function listado(): array
    {
        $asignados = DB::table('cargas.sede_recepcionista as s')->join('users as u', 'u.id', '=', 's.user_id')
            ->orderBy('u.name')->get(['s.almacen_id', 'u.id', 'u.name'])->groupBy('almacen_id');

        return Almacen::query()->where('activo', true)->orderBy('nombre')->get(['id', 'codigo', 'nombre'])
            ->map(fn ($a) => [...$a->toArray(), 'recepcionistas' => ($asignados[$a->id] ?? collect())
                ->map(fn ($r) => ['id' => $r->id, 'name' => $r->name])->values()])
            ->all();
    }

    /** @param list<int> $usuarios */
    public function asignar(int $almacenId, array $usuarios): void
    {
        DB::transaction(function () use ($almacenId, $usuarios) {
            DB::table('cargas.sede_recepcionista')->where('almacen_id', $almacenId)->delete();
            foreach (array_unique($usuarios) as $id) {
                DB::table('cargas.sede_recepcionista')->insert(['almacen_id' => $almacenId, 'user_id' => $id]);
            }
        });
    }
}
