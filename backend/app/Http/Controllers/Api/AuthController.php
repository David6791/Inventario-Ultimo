<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permisos;
use App\Http\Controllers\Controller;
use App\Http\Resources\UsuarioResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'email'       => ['required', 'email'],
            'password'    => ['required', 'string'],
            'dispositivo' => ['nullable', 'string', 'max:100'],
        ]);

        $usuario = \App\Models\User::where('email', $datos['email'])->first();

        if (! $usuario || ! Hash::check($datos['password'], $usuario->password)) {
            throw ValidationException::withMessages([
                'email' => 'El correo o la contraseña no coinciden.',
            ]);
        }

        if (! $usuario->activo) {
            throw ValidationException::withMessages([
                'email' => 'Su cuenta está desactivada. Comuníquese con el administrador.',
            ]);
        }

        // Un token por dispositivo; al reingresar se revoca el anterior del mismo.
        $dispositivo = $datos['dispositivo'] ?? 'web';
        $usuario->tokens()->where('name', $dispositivo)->delete();

        $token = $usuario->createToken($dispositivo)->plainTextToken;

        $usuario->forceFill(['ultimo_acceso_en' => now()])->save();

        return response()->json([
            'token'   => $token,
            'usuario' => $this->perfil($usuario),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->perfil($request->user()));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['mensaje' => 'Sesión cerrada.']);
    }

    public function cambiarClave(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'password_actual' => ['required', 'string'],
            'password'        => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);

        $usuario = $request->user();

        if (! Hash::check($datos['password_actual'], $usuario->password)) {
            throw ValidationException::withMessages([
                'password_actual' => 'La contraseña actual no es correcta.',
            ]);
        }

        $usuario->forceFill([
            'password'           => $datos['password'],
            'debe_cambiar_clave' => false,
        ])->save();

        return response()->json(['mensaje' => 'Contraseña actualizada.']);
    }

    /**
     * Este es el payload del que vive todo el frontend: identidad, permisos
     * efectivos (planos, ya resueltos desde los roles) y almacenes accesibles.
     */
    private function perfil(\App\Models\User $usuario): array
    {
        $usuario->load(['roles', 'almacenes']);

        /*
        | El super-admin no tiene permisos en tabla: su acceso se resuelve por
        | Gate::before. Eso es correcto del lado del servidor, pero el frontend
        | consume esta lista para armar el menu y evaluar los guards, y con un
        | arreglo vacio le bloquearia todo. Por eso acá se le devuelve el
        | catalogo completo.
        |
        | No debilita nada: la autorizacion real la sigue decidiendo Laravel en
        | cada request. Esta lista solo sirve para que la interfaz muestre lo
        | que corresponde.
        */
        $permisos = $usuario->hasRole(Permisos::SUPER_ADMIN)
            ? collect(Permisos::todos())
            : $usuario->getAllPermissions()->pluck('name')->values();

        return [
            'usuario'   => new UsuarioResource($usuario),
            'roles'     => $usuario->roles->pluck('name'),
            'permisos'  => $permisos,
            'almacenes' => $usuario->almacenes->map(fn ($a) => [
                'id'     => $a->id,
                'codigo' => $a->codigo,
                'nombre' => $a->nombre,
                'es_predeterminado' => (bool) $a->pivot->es_predeterminado,
            ]),
            'debe_cambiar_clave' => (bool) $usuario->debe_cambiar_clave,
        ];
    }
}
