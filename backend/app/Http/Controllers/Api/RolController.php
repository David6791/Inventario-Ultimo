<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RolRequest;
use App\Http\Resources\RolResource;
use App\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Services\VersionPermisosService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class RolController extends Controller
{
    /*
    | Sin authorizeResource(): desde Laravel 11 ese metodo depende de
    | $this->middleware(), que ya no existe en la clase base Controller. Cada
    | accion llama a authorize() de forma explicita, que ademas deja a la vista
    | que permiso exige.
    */
    public function __construct(private VersionPermisosService $version) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Role::class);

        $roles = Role::query()
            ->withCount('users')
            ->with('permissions:id,name')
            ->when($request->filled('buscar'), fn ($q) => $q->where('name', 'ilike', '%'.$request->string('buscar').'%'))
            ->orderBy('es_sistema', 'desc')
            ->orderBy('name')
            ->paginate($request->integer('por_pagina', 15));

        return RolResource::collection($roles);
    }

    public function show(Role $rol): RolResource
    {
        $this->authorize('view', $rol);

        return new RolResource($this->conConteo($rol));
    }

    public function store(RolRequest $request): JsonResponse
    {
        $this->authorize('create', Role::class);

        $rol = DB::transaction(function () use ($request) {
            $rol = Role::create([
                'name'        => $request->string('name')->trim()->value(),
                'guard_name'  => 'sanctum',
                'descripcion' => $request->input('descripcion'),
                'es_sistema'  => false,
            ]);

            $this->sincronizarPermisos($rol, $request->input('permisos', []));

            return $rol;
        });

        $this->version->invalidar();

        return response()->json(
            new RolResource($this->conConteo($rol)),
            201
        );
    }

    /**
     * Carga los permisos y el número de usuarios de un rol.
     *
     * El conteo se hace con una consulta propia en vez de `loadCount()`.
     * `loadCount()` sobre un modelo suelto reconsulta la tabla por clave y, si
     * esa reconsulta no devuelve filas, falla adentro de Laravel con un error
     * sobre `getAttributes()` en nulo que no dice nada de la causa.
     *
     * Tampoco se restringen las columnas de `permissions`: en una relación
     * de muchos a muchos eso puede dejar fuera las claves del pivote y devolver
     * la relación vacía sin avisar. Son pocas filas; no vale el riesgo.
     */
    private function conConteo(Role $rol): Role
    {
        $rol->load('permissions');
        $rol->setAttribute('users_count', $rol->users()->count());

        return $rol;
    }

    /**
     * Asigna los permisos resolviéndolos explícitamente por nombre y guard.
     *
     * `syncPermissions()` con nombres sueltos falla de forma opaca si el guard
     * del rol no coincide con el de los permisos: Spatie no los encuentra y
     * termina operando sobre nulos. Resolverlos acá permite decir cuál faltó.
     *
     * @param  list<string>  $nombres
     */
    private function sincronizarPermisos(Role $rol, array $nombres): void
    {
        $nombres = array_values(array_filter(
            $nombres,
            fn ($n) => is_string($n) && trim($n) !== ''
        ));

        if (empty($nombres)) {
            $rol->syncPermissions([]);
            return;
        }

        $guard = $rol->guard_name ?: config('auth.defaults.guard');

        $permisos = Permission::whereIn('name', $nombres)
            ->where('guard_name', $guard)
            ->get();

        // Si falta alguno, el problema casi siempre es el guard: los permisos
        // se sembraron con uno y el rol quedó con otro.
        if ($permisos->count() !== count($nombres)) {
            $faltantes = array_diff($nombres, $permisos->pluck('name')->all());

            abort(422, sprintf(
                'No se encontraron estos permisos para el guard "%s": %s. '
                .'Ejecute «php artisan db:seed --class=PermisoSeeder» y verifique '
                .'que roles y permisos usen el mismo guard.',
                $guard,
                implode(', ', $faltantes)
            ));
        }

        $rol->syncPermissions($permisos);
    }

    public function update(RolRequest $request, Role $rol): RolResource
    {
        $this->authorize('update', $rol);

        DB::transaction(function () use ($request, $rol) {
            // El nombre de un rol de sistema queda fijo; sus permisos sí se editan.
            if (! $rol->es_sistema) {
                $rol->name = $request->string('name')->trim()->value();
            }

            $rol->descripcion = $request->input('descripcion');
            $rol->save();

            $this->sincronizarPermisos($rol, $request->input('permisos', []));
        });

        $this->version->invalidar();

        return new RolResource($this->conConteo($rol->fresh()));
    }

    public function destroy(Role $rol): JsonResponse
    {
        $this->authorize('delete', $rol);

        // La Policy ya verificó que no sea de sistema y que nadie lo use, pero el
        // conteo pudo cambiar entre el listado y este request.
        abort_unless(
            $rol->puedeEliminarse(),
            409,
            'No se puede eliminar: el rol está asignado a uno o más usuarios.'
        );

        $rol->delete();

        $this->version->invalidar();

        return response()->json(['mensaje' => 'Rol eliminado.']);
    }

    /** Duplica un rol con sus permisos. Atajo muy usado al crear variantes. */
    public function duplicar(Role $rol): JsonResponse
    {
        $this->authorize('create', Role::class);

        $copia = DB::transaction(function () use ($rol) {
            $copia = Role::create([
                'name'        => $this->nombreDisponible($rol->name),
                'guard_name'  => 'sanctum',
                'descripcion' => $rol->descripcion,
                'es_sistema'  => false,
            ]);

            $copia->syncPermissions($rol->permissions);

            return $copia;
        });

        $this->version->invalidar();

        return response()->json(new RolResource($this->conConteo($copia)), 201);
    }

    private function nombreDisponible(string $base): string
    {
        $intento = "{$base} (copia)";
        $n = 2;

        while (Role::where('name', $intento)->exists()) {
            $intento = "{$base} (copia {$n})";
            $n++;
        }

        return $intento;
    }
}
