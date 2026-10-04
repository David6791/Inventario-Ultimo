<?php

namespace App\Modules\Activos\Imports;

use Illuminate\Support\Carbon;

/**
 * Una fila del Excel, ya normalizada.
 *
 * Existe para que el servicio de importación trabaje con nombres de campo y no
 * con posiciones de columna: si mañana se agrega una columna en el medio, el
 * cambio queda acá y no desparramado por las validaciones.
 */
class FilaActivo
{
    public array $errores = [];

    public function __construct(
        public readonly int $numero,          // fila del Excel, para el reporte
        public readonly ?string $claseCodigo,
        public readonly ?string $subclaseCodigo,
        public readonly ?string $denominacion,
        public readonly ?string $marca,
        public readonly ?string $modelo,
        public readonly ?string $serie,
        public readonly ?string $placa,
        public readonly ?int $anioFabricacion,
        public readonly ?string $origen,
        public readonly ?string $facturaNro,
        public readonly ?Carbon $facturaFecha,
        public readonly ?string $actaNro,
        public readonly ?Carbon $actaFecha,
        public readonly ?Carbon $fechaIncorporacion,
        public readonly ?Carbon $fechaInicioUso,
        public readonly ?string $ubicacionCodigo,
        public readonly ?string $condicion,
        public readonly string $moneda,
        public readonly float $tipoCambio,
        public readonly float $precio,
        public readonly float $flete,
        public readonly float $seguro,
        public readonly float $instalacion,
        public readonly float $otros,
        public readonly ?string $observaciones,
    ) {
    }

    public function total(): float
    {
        return $this->precio + $this->flete + $this->seguro + $this->instalacion + $this->otros;
    }

    public function valida(): bool
    {
        return empty($this->errores);
    }

    public function error(string $mensaje): void
    {
        $this->errores[] = $mensaje;
    }

    /** Desglose en el formato que espera AltaService. */
    public function costos(): array
    {
        $conceptos = [
            'PRECIO'      => $this->precio,
            'FLETE'       => $this->flete,
            'SEGURO'      => $this->seguro,
            'INSTALACION' => $this->instalacion,
            'OTRO'        => $this->otros,
        ];

        return collect($conceptos)
            ->filter(fn ($monto) => $monto > 0)
            ->map(fn ($monto, $concepto) => ['concepto' => $concepto, 'monto' => $monto])
            ->values()
            ->all();
    }

    /** Resumen para el reporte de previsualización. */
    public function aArray(): array
    {
        return [
            'numero'        => $this->numero,
            'clase'         => $this->claseCodigo,
            'subclase'      => $this->subclaseCodigo,
            'denominacion'  => $this->denominacion,
            'marca'         => $this->marca,
            'modelo'        => $this->modelo,
            'serie'         => $this->serie,
            'ubicacion'     => $this->ubicacionCodigo,
            'incorporacion' => $this->fechaIncorporacion?->toDateString(),
            'total'         => $this->total(),
            'errores'       => $this->errores,
            'valida'        => $this->valida(),
        ];
    }
}
