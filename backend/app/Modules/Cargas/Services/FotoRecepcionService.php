<?php

namespace App\Modules\Cargas\Services;

use App\Models\User;
use App\Modules\Cargas\Models\PlantillaBascula;
use App\Modules\Cargas\Models\RecepcionFoto;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Fotos de la recepción: se guardan al subirlas (para leerlas y tenerlas de
 * respaldo) y se ligan al pesaje cuando se registra. Las que nunca se ligaron
 * (la persona tomó otra o abandonó la recepción) se borran después de un día.
 */
class FotoRecepcionService
{
    public const DISCO = 'local';

    public function __construct(private readonly OcrTicketService $ocr)
    {
    }

    public function subir(UploadedFile $imagen, ?UploadedFile $original, string $tipo, ?PlantillaBascula $plantilla, User $usuario): RecepcionFoto
    {
        if (random_int(1, 20) === 1) {
            $this->limpiarSueltas();       // sin cron: de vez en cuando, al subir
        }
        $carpeta = 'cargas/fotos/' . now()->format('Y/m');
        $nombre = (string) Str::uuid();
        $ruta = $imagen->storeAs($carpeta, $nombre . '.' . $this->extension($imagen), self::DISCO);
        $rutaOriginal = $original?->storeAs($carpeta, $nombre . '-original.' . $this->extension($original), self::DISCO);

        $lectura = null;
        if ($plantilla && $plantilla->campos) {
            $lectura = $this->leer(Storage::disk(self::DISCO)->path($ruta), $plantilla->campos);
        }

        return RecepcionFoto::create([
            'tipo'          => $tipo,
            'ruta'          => $ruta,
            'ruta_original' => $rutaOriginal ?: null,
            'plantilla_id'  => $plantilla?->id,
            'lectura'       => $lectura,
            'subida_por'    => $usuario->id,
        ]);
    }

    /** Lectura con OCR; si Tesseract no está o falla, la foto igual se guarda y se digita a mano. */
    public function leer(string $ruta, array $campos): array
    {
        try {
            return $this->ocr->leer($ruta, $campos);
        } catch (\Throwable $e) {
            report($e);

            return ['campos' => [], 'coherente' => null,
                    'avisos' => ['No se pudo leer la foto automáticamente: anote los datos mirando el ticket.']];
        }
    }

    public function rutaAbsoluta(RecepcionFoto $foto, bool $original = false): ?string
    {
        $ruta = $original ? ($foto->ruta_original ?? $foto->ruta) : $foto->ruta;

        return Storage::disk(self::DISCO)->exists($ruta) ? Storage::disk(self::DISCO)->path($ruta) : null;
    }

    /** Borra las fotos que nadie ligó a un pesaje. */
    public function limpiarSueltas(int $horas = 24): int
    {
        $n = 0;
        RecepcionFoto::whereNull('pesaje_id')->whereNull('pesaje_saco_id')
            ->where('created_at', '<', now()->subHours($horas))
            ->orderBy('id')
            ->each(function (RecepcionFoto $f) use (&$n) {
                Storage::disk(self::DISCO)->delete(array_filter([$f->ruta, $f->ruta_original]));
                $f->delete();
                $n++;
            });

        return $n;
    }

    private function extension(UploadedFile $f): string
    {
        return match ($f->getMimeType()) {
            'image/png'  => 'png',
            'image/webp' => 'webp',
            default      => 'jpg',
        };
    }
}
