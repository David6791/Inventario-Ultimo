<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UsuarioRequest;
use App\Http\Resources\UsuarioResource;
use App\Models\User;
use App\Services\VersionPermisosService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class UsuarioController extends Controller
{
    /*
    | Sin authorizeResource(): desde Laravel 11 ese metodo depende de
    | $this->middleware(), que ya no existe en la clase base Controller.
    */
    public function __construct(private VersionPermisosService $version) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', User::class);

        $usuarios = User::query()
            // 'almacenes' completo, sin seleccionar columnas: el UsuarioResource
            // lee $a->pivot->es_predeterminado y una seleccion parcial deja
            // fuera las claves del pivote.
            ->with(['roles:id,name', 'almacenes'])
            ->when($request->filled('buscar'), function ($q) use ($request) {
                $texto = '%'.$request->string('buscar').'%';
                $q->where(fn ($sub) => $sub
                    ->where('name', 'ilike', $texto)
                    ->orWhere('email', 'ilike', $texto)
                    ->orWhere('ci', 'ilike', $texto));
            })
            ->when($request->filled('rol'), fn ($q) => $q->whereHas('roles', fn ($r) => $r->where('name', $request->string('rol'))))
            ->when($request->filled('almacen_id'), fn ($q) => $q->whereHas('almacenes', fn ($a) => $a->where('almacenes.id', $request->integer('almacen_id'))))
            ->when($request->filled('activo'), fn ($q) => $q->where('activo', $request->boolean('activo')))
            ->orderBy('name')
            ->paginate($request->integer('por_pagina', 15))
            ->withQueryString();

        return UsuarioResource::collection($usuarios);
    }

    public function show(User $usuario): UsuarioResource
    {
        $this->authorize('view', $usuario);

        return new UsuarioResource($usuario->load(['roles:id,name', 'almacenes']));
    }

    public function store(UsuarioRequest $request): JsonResponse
    {
        $this->authorize('create', User::class);

        $usuario = DB::transaction(function () use ($request) {
            $usuario = User::create([
                'ci'       => $request->input('ci'),
                'name'     => $request->string('name')->trim()->value(),
                'email'    => $request->string('email')->lower()->trim()->value(),
                'password' => $request->input('password'),
                'cargo'    => $request->input('cargo'),
                'telefono' => $request->input('telefono'),
                'activo'   => $request->boolean('activo', true),
                'debe_cambiar_clave' => true,
            ]);

            $usuario->syncRoles($request->input('roles', []));
            $this->sincronizarAlmacenes($usuario, $request);

            return $usuario;
        });

        return response()->json(
            new UsuarioResource($usuario->load(['roles:id,name', 'almacenes'])),
            201
        );
    }

    public function update(UsuarioRequest $request, User $usuario): UsuarioResource
    {
        $this->authorize('update', $usuario);

        DB::transaction(function () use ($request, $usuario) {
            $usuario->fill([
                'ci'       => $request->input('ci'),
                'name'     => $request->string('name')->trim()->value(),
                'email'    => $request->string('email')->lower()->trim()->value(),
                'cargo'    => $request->input('cargo'),
                'telefono' => $request->input('telefono'),
            ]);

            if ($request->filled('password')) {
                $usuario->password = $request->input('password');
                $usuario->debe_cambiar_clave = true;
            }

            // El estado activo se cambia por su propio endpoint, que tiene su
            // propia autorización; acá se ignora aunque venga en el payload.
            $usuario->save();

            $usuario->syncRoles($request->input('roles', []));
            $this->sincronizarAlmacenes($usuario, $request);
        });

        $this->version->invalidar();

        return new UsuarioResource($usuario->fresh()->load(['roles:id,name', 'almacenes']));
    }

    /** No se elimina: los movimientos de inventario referencian al usuario. */
    public function destroy(User $usuario): JsonResponse
    {
        abort(405, 'Los usuarios no se eliminan. Use la opción de desactivar.');
    }

    public function cambiarEstado(Request $request, User $usuario): UsuarioResource
    {
        $this->authorize('desactivar', $usuario);

        $activo = $request->boolean('activo');

        $usuario->forceFill(['activo' => $activo])->save();

        // Al desactivar se revocan los tokens: la sesión abierta muere en el acto.
        if (! $activo) {
            $usuario->tokens()->delete();
        }

        return new UsuarioResource($usuario->load(['roles:id,name', 'almacenes']));
    }

    public function restablecerClave(User $usuario): JsonResponse
    {
        $this->authorize('restablecerClave', $usuario);

        $temporal = Str::password(12, symbols: false);

        $usuario->forceFill([
            'password'           => $temporal,
            'debe_cambiar_clave' => true,
        ])->save();

        $usuario->tokens()->delete();

        // En producción esto va por correo, no en la respuesta. Se devuelve acá
        // porque muchas instituciones no tienen SMTP configurado y el
        // administrador necesita entregar la clave en mano.
        return response()->json([
            'mensaje'            => 'Contraseña restablecida. El usuario deberá cambiarla al ingresar.',
            'password_temporal'  => $temporal,
        ]);
    }

    public function asignarAlmacenes(Request $request, User $usuario): UsuarioResource
    {
        $this->authorize('asignarAlmacenes', $usuario);

        $request->validate([
            'almacenes'                 => ['present', 'array'],
            'almacenes.*'               => ['integer', 'exists:almacenes,id'],
            'almacen_predeterminado_id' => ['nullable', 'integer'],
        ]);

        $this->sincronizarAlmacenes($usuario, $request);

        return new UsuarioResource($usuario->fresh()->load(['roles:id,name', 'almacenes']));
    }

    private function sincronizarAlmacenes(User $usuario, Request $request): void
    {
        $ids = collect($request->input('almacenes', []))->map(fn ($id) => (int) $id);

        $predeterminado = (int) $request->input('almacen_predeterminado_id')
            ?: (int) $ids->first();

        $usuario->almacenes()->sync(
            $ids->mapWithKeys(fn ($id) => [
                $id => ['es_predeterminado' => $id === $predeterminado],
            ])->all()
        );
    }
}
