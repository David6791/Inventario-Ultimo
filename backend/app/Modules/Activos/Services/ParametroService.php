<?php

namespace App\Modules\Activos\Services;

use App\Modules\Activos\Models\Parametro;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ParametroService
{
    private const CACHE_TTL = 3600;

    /**
     * Valor vigente de un parámetro a una fecha, ya convertido a su tipo.
     * Sin fecha, asume hoy.
     */
    public function valor(string $clave, CarbonInterface|string|null $fecha = null): mixed
    {
        $fecha = $fecha ? Carbon::parse($fecha) : Carbon::today();
        $key   = "activos.parametro.{$clave}." . $fecha->toDateString();

        return Cache::remember($key, self::CACHE_TTL, function () use ($clave, $fecha) {
            $parametro = Parametro::query()
                ->where('clave', $clave)
                ->vigenteA($fecha)
                ->orderByDesc('vigente_desde')
                ->first();

            if (! $parametro) {
                throw new RuntimeException(
                    "No hay valor vigente del parámetro {$clave} al {$fecha->toDateString()}."
                );
            }

            return $parametro->casted;
        });
    }

    public function numero(string $clave, CarbonInterface|string|null $fecha = null): float
    {
        return (float) $this->valor($clave, $fecha);
    }

    public function booleano(string $clave, CarbonInterface|string|null $fecha = null): bool
    {
        return (bool) $this->valor($clave, $fecha);
    }

    public function texto(string $clave, CarbonInterface|string|null $fecha = null): string
    {
        return (string) $this->valor($clave, $fecha);
    }

    /**
     * Cambia el valor de un parámetro cerrando la vigencia anterior.
     * No sobreescribe historia: los períodos ya cerrados conservan el valor
     * que regía cuando se calcularon.
     */
    public function actualizar(
        string $clave,
        string $nuevoValor,
        CarbonInterface|string|null $desde = null,
        ?string $descripcion = null
    ): Parametro {
        $desde = $desde ? Carbon::parse($desde) : Carbon::today();

        return DB::transaction(function () use ($clave, $nuevoValor, $desde, $descripcion) {
            $anterior = Parametro::query()
                ->where('clave', $clave)
                ->vigenteA($desde)
                ->orderByDesc('vigente_desde')
                ->lockForUpdate()
                ->first();

            if (! $anterior) {
                throw new RuntimeException("El parámetro {$clave} no existe. Use crear() para uno nuevo.");
            }

            if ($anterior->vigente_desde->gte($desde)) {
                throw new RuntimeException(
                    'La nueva vigencia debe ser posterior al ' . $anterior->vigente_desde->toDateString() . '.'
                );
            }

            $anterior->update(['vigente_hasta' => $desde, 'updated_at' => now()]);

            $nuevo = Parametro::create([
                'clave'         => $clave,
                'valor'         => $nuevoValor,
                'tipo_dato'     => $anterior->tipo_dato,
                'descripcion'   => $descripcion ?? $anterior->descripcion,
                'vigente_desde' => $desde,
            ]);

            $this->olvidarCache($clave);

            return $nuevo;
        });
    }

    public function olvidarCache(string $clave): void
    {
        // El TTL de una hora limita el impacto; para cache taggeable
        // (Redis) conviene usar tags en lugar de este barrido.
        Cache::forget("activos.parametro.{$clave}." . Carbon::today()->toDateString());
    }

    /** Umbral de capitalización expresado en UFV. La conversión a bolivianos
     *  llega en el sprint 3, junto con el servicio de UFV. */
    public function umbralCapitalizacionUfv(CarbonInterface|string|null $fecha = null): float
    {
        return $this->numero(Parametro::UMBRAL_UFV, $fecha);
    }

    public function regimenAceleradoAdoptado(CarbonInterface|string|null $fecha = null): bool
    {
        return $this->booleano(Parametro::DS5563_ADOPTADO, $fecha);
    }
}
