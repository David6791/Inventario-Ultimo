<?php

namespace App\Modules\Activos\Services;

use App\Modules\Activos\Imports\FilaActivo;
use App\Modules\Activos\Models\Activo;
use App\Modules\Activos\Models\Clase;
use App\Modules\Activos\Models\Subclase;
use App\Modules\Activos\Models\Ubicacion;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\HeadingRowImport;
use RuntimeException;

/**
 * Importación masiva de activos desde Excel.
 *
 * DOS DECISIONES QUE DEFINEN TODO LO DEMÁS
 *
 * 1. La importación NO escribe en la tabla: delega en AltaService, fila por
 *    fila. Así cada activo importado pasa por las mismas reglas que uno
 *    cargado a mano — correlativo bloqueado, herencia de vida útil, régimen
 *    DS 5563, validación clase/subclase y movimiento en la bitácora. Una
 *    importación que escribe directo produce activos de segunda categoría,
 *    con datos que el resto del módulo no sabe interpretar.
 *
 * 2. Se valida TODO antes de escribir NADA. Un archivo con un error no
 *    importa nada: ni las filas buenas. Importar a medias deja al usuario sin
 *    saber qué entró y qué no, y el código correlativo ya consumido no se
 *    puede devolver.
 */
class ImportacionService
{
    /** Columnas esperadas, en el orden de la plantilla. */
    public const COLUMNAS = [
        'clase', 'subclase', 'denominacion', 'marca', 'modelo', 'serie', 'placa',
        'anio_fabricacion', 'origen', 'factura_nro', 'factura_fecha',
        'acta_nro', 'acta_fecha', 'fecha_incorporacion', 'fecha_inicio_uso',
        'ubicacion', 'condicion', 'moneda', 'tipo_cambio',
        'precio', 'flete', 'seguro', 'instalacion', 'otros', 'observaciones',
    ];

    private const LIMITE_FILAS = 2000;

    public function __construct(private readonly AltaService $altas)
    {
    }

    /**
     * Lee el archivo y valida cada fila SIN escribir nada.
     *
     * @return array{filas: list<array>, resumen: array}
     */
    public function validar(string $rutaArchivo): array
    {
        $this->verificarEncabezados($rutaArchivo);

        $filas = $this->leer($rutaArchivo);

        if (count($filas) > self::LIMITE_FILAS) {
            throw new RuntimeException(sprintf(
                'El archivo tiene %d filas y el máximo por importación es %d. '
                .'Divídalo en varios archivos.',
                count($filas), self::LIMITE_FILAS
            ));
        }

        if (empty($filas)) {
            throw new RuntimeException('El archivo no tiene filas con datos.');
        }

        $this->validarFilas($filas);

        $validas = collect($filas)->filter(fn (FilaActivo $f) => $f->valida());

        return [
            'filas' => array_map(fn (FilaActivo $f) => $f->aArray(), $filas),
            'resumen' => [
                'total'      => count($filas),
                'validas'    => $validas->count(),
                'con_error'  => count($filas) - $validas->count(),
                'valor_total'=> round($validas->sum(fn (FilaActivo $f) => $f->total()), 2),
                'importable' => $validas->count() === count($filas),
            ],
        ];
    }

    /**
     * Valida y, solo si no hay un solo error, importa todo en una transacción.
     *
     * @return array{creados: int, codigos: list<string>}
     */
    public function importar(string $rutaArchivo, int $usuarioId): array
    {
        $resultado = $this->validar($rutaArchivo);

        if (! $resultado['resumen']['importable']) {
            throw new RuntimeException(sprintf(
                'El archivo tiene %d fila(s) con errores. Corríjalas antes de importar: '
                .'no se importa parcialmente.',
                $resultado['resumen']['con_error']
            ));
        }

        $filas = $this->leer($rutaArchivo);
        $this->validarFilas($filas);

        return DB::transaction(function () use ($filas, $usuarioId) {
            $codigos = [];

            foreach ($filas as $fila) {
                $activo = $this->altas->registrar(
                    $this->datosParaAlta($fila),
                    $fila->costos(),
                    $usuarioId
                );

                $codigos[] = $activo->codigo;
            }

            return ['creados' => count($codigos), 'codigos' => $codigos];
        });
    }

    // ------------------------------------------------------------- Lectura

    private function verificarEncabezados(string $ruta): void
    {
        $encabezados = (new HeadingRowImport())->toArray($ruta)[0][0] ?? [];
        $encabezados = array_map(fn ($h) => strtolower(trim((string) $h)), $encabezados);

        $faltantes = array_diff(self::COLUMNAS, $encabezados);

        if (! empty($faltantes)) {
            throw new RuntimeException(
                'Al archivo le faltan columnas: ' . implode(', ', $faltantes)
                . '. Descargue la plantilla y respete los encabezados.'
            );
        }
    }

    /** @return list<FilaActivo> */
    private function leer(string $ruta): array
    {
        $hojas = Excel::toCollection(null, $ruta);
        $hoja = $hojas->first() ?? collect();

        $encabezado = $hoja->first();
        if (! $encabezado) {
            return [];
        }

        $indices = [];
        foreach ($encabezado as $i => $titulo) {
            $indices[strtolower(trim((string) $titulo))] = $i;
        }

        $filas = [];

        foreach ($hoja->skip(1) as $n => $cruda) {
            // El Excel es 1-based y la primera fila es el encabezado.
            $numeroExcel = $n + 1;

            $v = fn (string $col) => isset($indices[$col]) ? $cruda[$indices[$col]] ?? null : null;

            // Una fila completamente vacía se ignora: Excel suele arrastrar
            // cientos de filas en blanco al final.
            if (collect(self::COLUMNAS)->every(fn ($c) => blank($v($c)))) {
                continue;
            }

            $filas[] = new FilaActivo(
                numero:             $numeroExcel,
                claseCodigo:        $this->texto($v('clase'), 2),
                subclaseCodigo:     $this->texto($v('subclase'), 2),
                denominacion:       $this->texto($v('denominacion')),
                marca:              $this->texto($v('marca')),
                modelo:             $this->texto($v('modelo')),
                serie:              $this->texto($v('serie')),
                placa:              $this->texto($v('placa')),
                anioFabricacion:    $this->entero($v('anio_fabricacion')),
                origen:             $this->mayus($v('origen')) ?: 'COMPRA',
                facturaNro:         $this->texto($v('factura_nro')),
                facturaFecha:       $this->fecha($v('factura_fecha')),
                actaNro:            $this->texto($v('acta_nro')),
                actaFecha:          $this->fecha($v('acta_fecha')),
                fechaIncorporacion: $this->fecha($v('fecha_incorporacion')),
                fechaInicioUso:     $this->fecha($v('fecha_inicio_uso')),
                ubicacionCodigo:    $this->texto($v('ubicacion')),
                condicion:          $this->mayus($v('condicion')) ?: 'NUEVO',
                moneda:             $this->mayus($v('moneda')) ?: 'BOB',
                tipoCambio:         $this->decimal($v('tipo_cambio')) ?: 1.0,
                precio:             $this->decimal($v('precio')) ?? 0,
                flete:              $this->decimal($v('flete')) ?? 0,
                seguro:             $this->decimal($v('seguro')) ?? 0,
                instalacion:        $this->decimal($v('instalacion')) ?? 0,
                otros:              $this->decimal($v('otros')) ?? 0,
                observaciones:      $this->texto($v('observaciones')),
            );
        }

        return $filas;
    }

    // ---------------------------------------------------------- Validación

    /** @param list<FilaActivo> $filas */
    private function validarFilas(array $filas): void
    {
        $clases      = Clase::activas()->get()->keyBy('codigo');
        $subclases   = Subclase::activas()->with('clase')->get();
        $ubicaciones = Ubicacion::activas()->get()->keyBy('codigo');

        // Series ya registradas, para no chocar con la base.
        $seriesEnBase = Activo::whereNotNull('serie')->pluck('serie')
            ->map(fn ($s) => strtoupper($s))->flip();

        // Y series repetidas DENTRO del archivo: el error más común al
        // copiar filas, y uno que la base recién detectaría a mitad de camino.
        $seriesDelArchivo = [];

        foreach ($filas as $fila) {
            $this->validarObligatorios($fila);
            $clase = $this->validarClase($fila, $clases);
            $this->validarSubclase($fila, $clase, $subclases);
            $this->validarUbicacion($fila, $ubicaciones);
            $this->validarFechas($fila);
            $this->validarCosto($fila);
            $this->validarSerie($fila, $seriesEnBase, $seriesDelArchivo);
        }
    }

    private function validarObligatorios(FilaActivo $f): void
    {
        if (blank($f->denominacion)) {
            $f->error('Falta la denominación.');
        }

        if (blank($f->claseCodigo))    $f->error('Falta el código de clase.');
        if (blank($f->subclaseCodigo)) $f->error('Falta el código de subclase.');
        if (blank($f->ubicacionCodigo))$f->error('Falta el código de ubicación.');

        if (! in_array($f->origen, Activo::ORIGENES, true)) {
            $f->error("Origen «{$f->origen}» no válido. Use: " . implode(', ', Activo::ORIGENES));
        }

        if (! in_array($f->condicion, Activo::CONDICIONES, true)) {
            $f->error("Condición «{$f->condicion}» no válida.");
        }
    }

    private function validarClase(FilaActivo $f, $clases): ?Clase
    {
        if (blank($f->claseCodigo)) {
            return null;
        }

        $clase = $clases->get($f->claseCodigo);

        if (! $clase) {
            $f->error("No existe una clase activa con código «{$f->claseCodigo}».");
            return null;
        }

        return $clase;
    }

    private function validarSubclase(FilaActivo $f, ?Clase $clase, $subclases): void
    {
        if (! $clase || blank($f->subclaseCodigo)) {
            return;
        }

        $existe = $subclases->first(
            fn ($s) => $s->clase_id === $clase->id && $s->codigo === $f->subclaseCodigo
        );

        if (! $existe) {
            $f->error(
                "La subclase «{$f->subclaseCodigo}» no existe dentro de la clase «{$clase->nombre}»."
            );
        }
    }

    private function validarUbicacion(FilaActivo $f, $ubicaciones): void
    {
        if (blank($f->ubicacionCodigo)) {
            return;
        }

        if (! $ubicaciones->has($f->ubicacionCodigo)) {
            $f->error("No existe una ubicación activa con código «{$f->ubicacionCodigo}».");
        }
    }

    private function validarFechas(FilaActivo $f): void
    {
        if (! $f->fechaIncorporacion) {
            $f->error('Falta la fecha de incorporación o tiene un formato que no se pudo leer.');
            return;
        }

        if ($f->fechaIncorporacion->isFuture()) {
            $f->error('La fecha de incorporación no puede ser futura.');
        }

        if ($f->fechaInicioUso && $f->fechaInicioUso->lt($f->fechaIncorporacion)) {
            $f->error('El inicio de uso no puede ser anterior a la incorporación.');
        }

        if (in_array($f->origen, ['COMPRA', 'IMPORTACION'], true) && blank($f->actaNro)) {
            $f->error('Una compra requiere número de acta de recepción.');
        }
    }

    private function validarCosto(FilaActivo $f): void
    {
        if ($f->precio <= 0) {
            $f->error('El precio debe ser mayor a cero.');
        }

        if ($f->total() <= 0) {
            $f->error('El valor de origen debe ser mayor a cero.');
        }

        if ($f->moneda !== 'BOB' && $f->tipoCambio <= 0) {
            $f->error('Falta el tipo de cambio para una moneda distinta de BOB.');
        }
    }

    private function validarSerie(FilaActivo $f, $seriesEnBase, array &$seriesDelArchivo): void
    {
        if (blank($f->serie)) {
            return;
        }

        $serie = strtoupper($f->serie);

        if ($seriesEnBase->has($serie)) {
            $f->error("La serie «{$f->serie}» ya está registrada en el sistema.");
            return;
        }

        if (isset($seriesDelArchivo[$serie])) {
            $f->error(
                "La serie «{$f->serie}» está repetida en el archivo (ya aparece en la fila "
                . $seriesDelArchivo[$serie] . ').'
            );
            return;
        }

        $seriesDelArchivo[$serie] = $f->numero;
    }

    // ------------------------------------------------------------ Armado

    private function datosParaAlta(FilaActivo $f): array
    {
        $clase = Clase::where('codigo', $f->claseCodigo)->firstOrFail();

        $subclase = Subclase::where('clase_id', $clase->id)
            ->where('codigo', $f->subclaseCodigo)->firstOrFail();

        $ubicacion = Ubicacion::where('codigo', $f->ubicacionCodigo)->firstOrFail();

        return [
            'clase_id'             => $clase->id,
            'subclase_id'          => $subclase->id,
            'denominacion'         => $f->denominacion,
            'marca'                => $f->marca,
            'modelo'               => $f->modelo,
            'serie'                => $f->serie,
            'placa'                => $f->placa,
            'anio_fabricacion'     => $f->anioFabricacion,
            'tipo_origen'          => $f->origen,
            'factura_nro'          => $f->facturaNro,
            'factura_fecha'        => $f->facturaFecha?->toDateString(),
            'acta_recepcion_nro'   => $f->actaNro,
            'acta_recepcion_fecha' => $f->actaFecha?->toDateString(),
            'fecha_incorporacion'  => $f->fechaIncorporacion->toDateString(),
            'fecha_inicio_uso'     => $f->fechaInicioUso?->toDateString(),
            'ubicacion_id'         => $ubicacion->id,
            'condicion'            => $f->condicion,
            'moneda'               => $f->moneda,
            'tipo_cambio'          => $f->tipoCambio,
            'observaciones'        => $f->observaciones,
        ];
    }

    // ------------------------------------------------------- Normalización

    private function texto($valor, ?int $padCeros = null): ?string
    {
        $v = trim((string) ($valor ?? ''));

        if ($v === '') {
            return null;
        }

        // Excel convierte "05" en 5: se recupera el cero a la izquierda.
        return $padCeros ? str_pad($v, $padCeros, '0', STR_PAD_LEFT) : $v;
    }

    private function mayus($valor): ?string
    {
        $v = $this->texto($valor);
        return $v ? strtoupper($v) : null;
    }

    private function entero($valor): ?int
    {
        return is_numeric($valor) ? (int) $valor : null;
    }

    private function decimal($valor): ?float
    {
        if (blank($valor)) {
            return null;
        }

        // Acepta "1.234,56" y "1234.56": en Bolivia conviven los dos formatos.
        $v = str_replace(' ', '', (string) $valor);

        if (str_contains($v, ',') && str_contains($v, '.')) {
            $v = str_replace('.', '', $v);
        }

        $v = str_replace(',', '.', $v);

        return is_numeric($v) ? (float) $v : null;
    }

    private function fecha($valor): ?Carbon
    {
        if (blank($valor)) {
            return null;
        }

        // Fecha nativa de Excel: número de días desde 1900.
        if (is_numeric($valor)) {
            try {
                return Carbon::instance(
                    \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($valor)
                );
            } catch (\Throwable) {
                return null;
            }
        }

        foreach (['d/m/Y', 'Y-m-d', 'd-m-Y', 'd/m/y'] as $formato) {
            try {
                return Carbon::createFromFormat($formato, trim((string) $valor))->startOfDay();
            } catch (\Throwable) {
                continue;
            }
        }

        return null;
    }
}
