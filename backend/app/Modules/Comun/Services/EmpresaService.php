<?php

namespace App\Modules\Comun\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Datos de la empresa para documentos y reportes. Se leen en cada PDF, así
 * que van en caché y se limpian al guardar. Las imágenes viven en el disco
 * privado (storage/app/private/empresa) y a los PDF llegan como data URI:
 * dompdf no necesita acceso a internet ni al enlace público de storage.
 */
class EmpresaService
{
    private const CACHE = 'comun.empresa';
    private const DISCO = 'local';

    /** @return array{nombre: string, subtitulo: ?string, logo_path: ?string, marca_agua_path: ?string, marca_agua_opacidad: float, updated_at: ?string} */
    public function datos(): array
    {
        return Cache::rememberForever(self::CACHE, function () {
            $fila = DB::table('comun.empresa')->where('id', 1)->first();

            return [
                'nombre'              => $fila->nombre ?? (config('app.empresa') ?: config('app.name')),
                'subtitulo'           => $fila->subtitulo ?? null,
                'logo_path'           => $fila->logo_path ?? null,
                'marca_agua_path'     => $fila->marca_agua_path ?? null,
                'marca_agua_opacidad' => (float) ($fila->marca_agua_opacidad ?? 0.08),
                'updated_at'          => $fila->updated_at ?? null,
            ];
        });
    }

    /** Lo que ve cualquiera (pantalla de ingreso, encabezado). */
    public function publico(): array
    {
        $d = $this->datos();

        return [
            'nombre'         => $d['nombre'],
            'subtitulo'      => $d['subtitulo'],
            'tiene_logo'     => $this->existe($d['logo_path']),
            'tiene_marca'    => $this->existe($d['marca_agua_path']),
            'marca_agua_opacidad' => $d['marca_agua_opacidad'],
            'version'        => $d['updated_at'] ? strtotime($d['updated_at']) : 0,
        ];
    }

    /** Para las vistas pdf.*: nombre, detalle e imágenes listas para <img src>. */
    public function paraPdf(): array
    {
        $d = $this->datos();

        return [
            'nombre'     => $d['nombre'],
            'subtitulo'  => $d['subtitulo'],
            'logo'       => $this->dataUri($d['logo_path']),
            'marca_agua' => $this->dataUri($d['marca_agua_path']),
            'opacidad'   => $d['marca_agua_opacidad'],
        ];
    }

    public function ruta(string $cual): ?string
    {
        $path = $this->datos()[$cual === 'logo' ? 'logo_path' : 'marca_agua_path'];

        return $this->existe($path) ? Storage::disk(self::DISCO)->path($path) : null;
    }

    public function actualizar(User $usuario, array $datos, ?UploadedFile $logo, ?UploadedFile $marca,
                               bool $quitarLogo, bool $quitarMarca): array
    {
        $actual = $this->datos();
        $cambios = [
            'nombre'              => $datos['nombre'],
            'subtitulo'           => $datos['subtitulo'] ?? null,
            'marca_agua_opacidad' => $datos['marca_agua_opacidad'] ?? $actual['marca_agua_opacidad'],
            'actualizado_por'     => $usuario->id,
            'updated_at'          => now(),
        ];

        if ($logo || $quitarLogo) {
            $this->borrar($actual['logo_path']);
            $cambios['logo_path'] = $logo ? $this->guardar($logo, 'logo') : null;
        }
        if ($marca || $quitarMarca) {
            $this->borrar($actual['marca_agua_path']);
            $cambios['marca_agua_path'] = $marca ? $this->guardar($marca, 'marca-agua') : null;
        }

        DB::table('comun.empresa')->updateOrInsert(['id' => 1], $cambios);
        Cache::forget(self::CACHE);

        return $this->publico();
    }

    private function guardar(UploadedFile $archivo, string $nombre): string
    {
        // Nombre con marca de tiempo: el navegador no muestra la imagen vieja desde su caché.
        return $archivo->storeAs('empresa', $nombre . '-' . now()->format('YmdHis') . '.' . strtolower($archivo->extension()), self::DISCO);
    }

    private function borrar(?string $path): void
    {
        if ($path && Storage::disk(self::DISCO)->exists($path)) {
            Storage::disk(self::DISCO)->delete($path);
        }
    }

    private function existe(?string $path): bool
    {
        return $path !== null && Storage::disk(self::DISCO)->exists($path);
    }

    private function dataUri(?string $path): ?string
    {
        if (! $this->existe($path)) {
            return null;
        }
        $disco = Storage::disk(self::DISCO);

        return 'data:' . ($disco->mimeType($path) ?: 'image/png') . ';base64,' . base64_encode($disco->get($path));
    }
}
