<?php

namespace App\Modules\Activos\Services;

use App\Modules\Activos\Models\Activo;
use App\Modules\Activos\Models\Foto;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Fotografías de los activos.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * EL TAMAÑO IMPORTA MÁS DE LO QUE PARECE
 *
 * Una foto de teléfono pesa entre 3 y 5 MB. Mil activos con tres fotos cada
 * uno son 12 GB en disco y, lo que es peor, una ficha que tarda en abrir
 * sobre la conexión de un acopio remoto.
 *
 * Para identificar un equipo alcanza con 1600 px de lado largo y calidad 80,
 * que da unos 200 KB. La miniatura de 300 px pesa 15 KB y es la que se usa en
 * listados y galerías: solo se descarga la grande cuando alguien la abre.
 *
 * La compresión también ocurre del lado del cliente antes de subir, pero no se
 * confía en eso: alguien puede llamar al endpoint directamente.
 */
class FotoService
{
    private const MAXIMO_POR_ACTIVO = 6;
    private const LADO_LARGO = 1600;
    private const LADO_MINIATURA = 300;
    private const CALIDAD = 80;

    public function subir(
        Activo $activo,
        UploadedFile $archivo,
        string $tipo,
        int $usuarioId,
        ?string $descripcion = null,
        bool $principal = false
    ): Foto {

        $cantidad = Foto::where('activo_id', $activo->id)->count();

        if ($cantidad >= self::MAXIMO_POR_ACTIVO) {
            throw new RuntimeException(sprintf(
                'El bien ya tiene %d fotos, que es el máximo. Elimine alguna antes de '
                .'agregar otra: un activo con veinte fotos de lo mismo no se documenta '
                .'mejor, solo pesa más.',
                self::MAXIMO_POR_ACTIVO
            ));
        }

        if (! in_array($tipo, array_keys(Foto::TIPOS), true)) {
            throw new RuntimeException("Tipo de foto «{$tipo}» no reconocido.");
        }

        return DB::transaction(function () use (
            $activo, $archivo, $tipo, $usuarioId, $descripcion, $principal, $cantidad
        ) {
            $nombre = $this->nombreDe($activo, $tipo);

            [$path, $miniatura, $info] = $this->guardarYRedimensionar($archivo, $activo, $nombre);

            // La primera foto es principal por omisión: sin eso, un activo con
            // fotos no mostraría ninguna en los listados.
            $esPrincipal = $principal || $cantidad === 0;

            if ($esPrincipal) {
                Foto::where('activo_id', $activo->id)->update(['es_principal' => false]);
            }

            $foto = Foto::create([
                'activo_id'      => $activo->id,
                'path'           => $path,
                'path_miniatura' => $miniatura,
                'tipo'           => $tipo,
                'descripcion'    => $descripcion,
                'es_principal'   => $esPrincipal,
                'tamanio_bytes'  => $info['bytes'],
                'ancho'          => $info['ancho'],
                'alto'           => $info['alto'],
                'subido_por'     => $usuarioId,
                'created_at'     => now(),
            ]);

            if ($esPrincipal) {
                // Se replica en el activo para que los listados no tengan que
                // consultar la tabla de fotos en cada fila.
                $activo->update(['foto_path' => $miniatura]);
            }

            return $foto;
        });
    }

    public function marcarPrincipal(Foto $foto): Foto
    {
        return DB::transaction(function () use ($foto) {
            Foto::where('activo_id', $foto->activo_id)->update(['es_principal' => false]);

            $foto->update(['es_principal' => true]);

            Activo::where('id', $foto->activo_id)
                ->update(['foto_path' => $foto->path_miniatura ?? $foto->path]);

            return $foto->fresh();
        });
    }

    /**
     * Elimina una foto y su archivo.
     *
     * Si era la principal, otra ocupa su lugar: un activo que tenía foto no
     * debería quedarse sin ninguna por borrar la que estaba destacada.
     */
    public function eliminar(Foto $foto): void
    {
        DB::transaction(function () use ($foto) {
            $activoId = $foto->activo_id;
            $eraPrincipal = $foto->es_principal;

            Storage::disk('public')->delete(array_filter([
                $foto->path, $foto->path_miniatura,
            ]));

            $foto->delete();

            if (! $eraPrincipal) {
                return;
            }

            $siguiente = Foto::where('activo_id', $activoId)
                ->orderBy('created_at')
                ->first();

            if ($siguiente) {
                $siguiente->update(['es_principal' => true]);
                Activo::where('id', $activoId)
                    ->update(['foto_path' => $siguiente->path_miniatura ?? $siguiente->path]);
            } else {
                Activo::where('id', $activoId)->update(['foto_path' => null]);
            }
        });
    }

    // ──────────────────────────────────────────────────── Procesamiento

    /**
     * Guarda la imagen redimensionada y su miniatura.
     *
     * Usa GD, que ya está en el contenedor porque lo pedía maatwebsite/excel.
     * No hace falta Intervention Image para esto.
     *
     * @return array{0: string, 1: string, 2: array}
     */
    private function guardarYRedimensionar(UploadedFile $archivo, Activo $activo, string $nombre): array
    {
        $carpeta = 'activos/' . $activo->id;

        $origen = $this->abrirImagen($archivo->getRealPath(), $archivo->getMimeType());

        $anchoOriginal = imagesx($origen);
        $altoOriginal  = imagesy($origen);

        // La orientación EXIF de las fotos de teléfono se pierde al
        // reprocesar: hay que aplicarla a mano o la foto sale acostada.
        $origen = $this->corregirOrientacion($origen, $archivo->getRealPath());

        $grande = $this->redimensionar($origen, self::LADO_LARGO);
        $mini   = $this->redimensionar($origen, self::LADO_MINIATURA);

        $pathGrande = "{$carpeta}/{$nombre}.jpg";
        $pathMini   = "{$carpeta}/{$nombre}-mini.jpg";

        Storage::disk('public')->makeDirectory($carpeta);

        imagejpeg($grande, Storage::disk('public')->path($pathGrande), self::CALIDAD);
        imagejpeg($mini, Storage::disk('public')->path($pathMini), self::CALIDAD);

        $info = [
            'bytes' => Storage::disk('public')->size($pathGrande),
            'ancho' => imagesx($grande),
            'alto'  => imagesy($grande),
        ];

        imagedestroy($origen);
        imagedestroy($grande);
        imagedestroy($mini);

        return [$pathGrande, $pathMini, $info];
    }

    private function abrirImagen(string $ruta, ?string $mime)
    {
        $imagen = match ($mime) {
            'image/jpeg', 'image/jpg' => imagecreatefromjpeg($ruta),
            'image/png'               => imagecreatefrompng($ruta),
            'image/webp'              => imagecreatefromwebp($ruta),
            default => throw new RuntimeException(
                'Formato no admitido. Use JPG, PNG o WEBP.'
            ),
        };

        if (! $imagen) {
            throw new RuntimeException('No se pudo leer la imagen.');
        }

        return $imagen;
    }

    /**
     * Las cámaras de teléfono guardan la foto siempre en la misma orientación
     * física y anotan en EXIF cómo rotarla. Al reprocesar se pierde ese dato,
     * así que hay que aplicarlo antes.
     */
    private function corregirOrientacion($imagen, string $ruta)
    {
        if (! function_exists('exif_read_data')) {
            return $imagen;
        }

        $exif = @exif_read_data($ruta);

        if (! $exif || ! isset($exif['Orientation'])) {
            return $imagen;
        }

        return match ((int) $exif['Orientation']) {
            3 => imagerotate($imagen, 180, 0),
            6 => imagerotate($imagen, -90, 0),
            8 => imagerotate($imagen, 90, 0),
            default => $imagen,
        };
    }

    /** Redimensiona manteniendo la proporción, sin agrandar. */
    private function redimensionar($origen, int $ladoLargo)
    {
        $ancho = imagesx($origen);
        $alto  = imagesy($origen);

        $mayor = max($ancho, $alto);

        if ($mayor <= $ladoLargo) {
            $nuevoAncho = $ancho;
            $nuevoAlto  = $alto;
        } elseif ($ancho >= $alto) {
            $nuevoAncho = $ladoLargo;
            $nuevoAlto  = (int) round($alto * $ladoLargo / $ancho);
        } else {
            $nuevoAlto  = $ladoLargo;
            $nuevoAncho = (int) round($ancho * $ladoLargo / $alto);
        }

        $destino = imagecreatetruecolor($nuevoAncho, $nuevoAlto);

        // Fondo blanco: un PNG con transparencia quedaría negro al pasar a JPG.
        $blanco = imagecolorallocate($destino, 255, 255, 255);
        imagefilledrectangle($destino, 0, 0, $nuevoAncho, $nuevoAlto, $blanco);

        imagecopyresampled(
            $destino, $origen, 0, 0, 0, 0,
            $nuevoAncho, $nuevoAlto, $ancho, $alto
        );

        return $destino;
    }

    private function nombreDe(Activo $activo, string $tipo): string
    {
        return Str::lower($tipo) . '-' . now()->format('Ymd-His') . '-' . Str::random(6);
    }
}
