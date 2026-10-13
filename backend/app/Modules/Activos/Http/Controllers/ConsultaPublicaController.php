<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Activos\Models\Activo;
use Illuminate\Http\JsonResponse;

/**
 * Consulta de un bien por su código, sin autenticación.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * QUÉ DEVUELVE Y QUÉ NO
 *
 * Es la vista que se abre al escanear la etiqueta. Sirve para verificar en
 * terreno: qué es el bien, cómo se ve, dónde debería estar, quién responde
 * por él.
 *
 * NO devuelve valores: ni costo, ni valuación, ni depreciación. Quien escanea
 * tiene el bien delante y ya conoce su código —está impreso ahí mismo— pero
 * eso no es razón para mostrarle cuánto costó.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * POR QUÉ SIN AUTENTICACIÓN
 *
 * La mayor parte del personal no tiene cuenta. Un supervisor en el acopio que
 * quiere confirmar que una herramienta está donde dice el registro necesita
 * escanear y ver, no gestionar un usuario.
 *
 * El control está en qué se muestra, no en quién mira.
 */
class ConsultaPublicaController extends Controller
{
    public function porCodigo(string $codigo): JsonResponse
    {
        $activo = Activo::query()
            ->where('codigo', strtoupper(trim($codigo)))
            ->with([
                'clase:id,codigo,nombre',
                'subclase:id,codigo,nombre',
                'ubicacion:id,codigo,nombre,padre_id',
                'ubicacion.padre:id,nombre,padre_id',
                'custodio:id,nombres,apellido_paterno,apellido_materno,cargo,centro_costo_id',
                'custodio.centro:id,codigo,nombre',
                'fotos',
            ])
            ->first();

        if (! $activo) {
            return response()->json([
                'mensaje' => 'No existe un bien con ese código.',
                'codigo'  => $codigo,
            ], 404);
        }

        return response()->json(['data' => $this->fichaPublica($activo)]);
    }

    /**
     * Lo que se muestra al escanear.
     *
     * Cada campo responde a una pregunta que alguien se hace con el bien
     * delante: ¿es este?, ¿está donde debería?, ¿quién responde por él?,
     * ¿se puede mover?
     */
    private function fichaPublica(Activo $a): array
    {
        return [
            'codigo'       => $a->codigo,
            'denominacion' => $a->denominacion,

            // La foto es lo que permite confirmar que la etiqueta corresponde
            // al bien que se tiene delante, y no a otro parecido.
            'fotos' => $a->fotos
                ->sortByDesc('es_principal')
                ->values()
                ->map(fn ($f) => [
                    'url'       => $f->url,
                    'miniatura' => $f->url_miniatura,
                    'tipo'      => $f->etiqueta_tipo,
                    'fecha'     => $f->created_at?->toDateString(),
                ]),

            'identificacion' => [
                'marca'  => $a->marca,
                'modelo' => $a->modelo,
                'serie'  => $a->serie,
                'placa'  => $a->placa,
                'anio'   => $a->anio_fabricacion,
            ],

            'clasificacion' => [
                'clase'    => $a->clase?->nombre,
                'subclase' => $a->subclase?->nombre,
            ],

            'situacion' => [
                'estado'    => $a->estado,
                'condicion' => $a->condicion,
                // El dato operativo más útil: si no tiene custodio, alguien
                // tiene que asignarlo.
                'asignado'  => $a->custodio_id !== null,
            ],

            'ubicacion' => [
                'nombre' => $a->ubicacion?->nombre,
                'ruta'   => $a->ubicacion?->ruta,
            ],

            'custodio' => $a->custodio ? [
                'nombre' => $a->custodio->nombre_completo,
                'cargo'  => $a->custodio->cargo,
                'centro' => $a->custodio->centro?->nombre,
            ] : null,

            'incorporacion' => $a->fecha_incorporacion?->toDateString(),

            'es_bien_control' => $a->es_bien_control,

            // Sin valores: ni costo, ni valuación, ni depreciación.
        ];
    }
}
