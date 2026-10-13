<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Activos\Models\Activo;
use App\Modules\Activos\Models\Foto;
use App\Modules\Activos\Services\FotoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class FotoController extends Controller
{
    public function __construct(private readonly FotoService $fotos)
    {
    }

    public function index(Activo $activo): JsonResponse
    {
        $fotos = Foto::where('activo_id', $activo->id)
            ->orderByDesc('es_principal')
            ->orderBy('created_at')
            ->get()
            ->map(fn ($f) => $this->serializar($f));

        return response()->json(['data' => $fotos]);
    }

    public function store(Request $request, Activo $activo): JsonResponse
    {
        $datos = $request->validate([
            // 8 MB: una foto de teléfono sin comprimir entra, y el servicio
            // la reduce al guardarla.
            'archivo'     => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
            'tipo'        => ['required', Rule::in(array_keys(Foto::TIPOS))],
            'descripcion' => ['nullable', 'string', 'max:250'],
            'principal'   => ['boolean'],
        ]);

        try {
            $foto = $this->fotos->subir(
                $activo,
                $request->file('archivo'),
                $datos['tipo'],
                $request->user()->id,
                $datos['descripcion'] ?? null,
                $request->boolean('principal')
            );
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json(['data' => $this->serializar($foto)], 201);
    }

    public function marcarPrincipal(Foto $foto): JsonResponse
    {
        return response()->json([
            'data'    => $this->serializar($this->fotos->marcarPrincipal($foto)),
            'mensaje' => 'Foto principal actualizada.',
        ]);
    }

    public function destroy(Request $request, Foto $foto): JsonResponse
    {
        abort_unless($request->user()->can('activos.editar'), 403,
            'Necesita el permiso «activos.editar» para eliminar fotos.');

        $this->fotos->eliminar($foto);

        return response()->json(['mensaje' => 'Foto eliminada.']);
    }

    private function serializar(Foto $f): array
    {
        return [
            'id'            => $f->id,
            'url'           => $f->url,
            'url_miniatura' => $f->url_miniatura,
            'tipo'          => $f->tipo,
            'etiqueta_tipo' => $f->etiqueta_tipo,
            'descripcion'   => $f->descripcion,
            'es_principal'  => $f->es_principal,
            'tamanio_kb'    => $f->tamanio_bytes ? round($f->tamanio_bytes / 1024) : null,
            'created_at'    => $f->created_at?->toIso8601String(),
        ];
    }
}
