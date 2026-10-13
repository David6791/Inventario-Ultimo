<?php

namespace App\Modules\Activos\Services;

use App\Modules\Activos\Models\Area;
use App\Modules\Activos\Models\CentroCosto;
use App\Modules\Activos\Models\Empleado;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use RuntimeException;

/**
 * Importación de personal desde el formato de planilla.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * QUÉ SE IMPORTA Y QUÉ NO
 *
 * El archivo de planilla trae 42 columnas. La mayoría son de nómina: Haber
 * Básico, AFP, NUA, Aporte AFP, Tipo Planilla, Tipo Pago, Moneda.
 *
 * Nada de eso se importa. Un módulo de activos fijos no tiene por qué guardar
 * sueldos ni datos previsionales: no los necesita para nada y almacenarlos
 * crea una obligación de resguardo que no le corresponde.
 *
 * Se toma lo que hace falta para la custodia: quién es, cómo identificarlo,
 * dónde trabaja y cómo contactarlo.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ÁREAS Y CENTROS SE CREAN SOLOS
 *
 * El archivo trae los nombres (PORCO, ACOPIO_PORCO). Si no existen, se crean
 * al importar. Después se les asigna el almacén desde la pantalla de centros,
 * que es lo que habilita el ámbito de visibilidad.
 */
class ImportacionEmpleadosService
{
    /** Columnas del formato de planilla que sí se usan, por su encabezado. */
    private const MAPA = [
        'codigo'           => ['Código (*)', 'Codigo (*)', 'Código', 'Codigo'],
        'nombres'          => ['Nombre (*)', 'Nombre', 'Nombres'],
        'segundo_nombre'   => ['Segundo Nombre'],
        'apellido_paterno' => ['Apellido Paterno (*)', 'Apellido Paterno'],
        'apellido_materno' => ['Apellido Materno(*)', 'Apellido Materno'],
        'profesion'        => ['Profesión', 'Profesion'],
        'direccion'        => ['Dirección', 'Direccion'],
        'tipo_documento'   => ['Tipo Documento       (*)', 'Tipo Documento'],
        'ci'               => ['C.I. (*)', 'C.I.', 'CI'],
        'expedido'         => ['Expedido'],
        'telefono'         => ['Telefono 1', 'Teléfono 1', 'Telefono'],
        'movil'            => ['Móvil', 'Movil'],
        'email'            => ['E_mail', 'Email', 'E-mail'],
        'fecha_ingreso'    => ['Fecha Ingreso (dd/mm/yyyy)', 'Fecha Ingreso'],
        'cargo'            => ['Cargo(*)', 'Cargo'],
        'area'             => ['Area', 'Área'],
        'centro_costo'     => ['Centro de Costo', 'Centro de costo'],
        'observaciones'    => ['Observacion', 'Observación'],
    ];

    private const LIMITE_FILAS = 2000;

    /** Valida sin escribir nada. */
    public function validar(string $ruta, string $extension = 'xlsx')
    {
        $filas = $this->leer($ruta, $extension);

        if (empty($filas)) {
            throw new RuntimeException('El archivo no tiene filas con datos.');
        }

        if (count($filas) > self::LIMITE_FILAS) {
            throw new RuntimeException(
                'El archivo supera las ' . self::LIMITE_FILAS . ' filas. Divídalo.'
            );
        }

        $this->validarFilas($filas);

        $validas = collect($filas)->where('valida', true);

        return [
            'filas'   => $filas,
            'resumen' => [
                'total'       => count($filas),
                'validas'     => $validas->count(),
                'con_error'   => count($filas) - $validas->count(),
                'nuevos'      => $validas->where('existe', false)->count(),
                'existentes'  => $validas->where('existe', true)->count(),
                'areas'       => $validas->pluck('area')->filter()->unique()->values(),
                'centros'     => $validas->pluck('centro_costo')->filter()->unique()->values(),
                'importable'  => $validas->count() === count($filas),
            ],
        ];
    }

    /** Importa solo si no hay una sola fila con error. */
     public function importar(string $ruta, int $usuarioId, string $extension = 'xlsx'): array
    {
        $resultado = $this->validar($ruta, $extension);

        if (! $resultado['resumen']['importable']) {
            throw new RuntimeException(sprintf(
                'El archivo tiene %d fila(s) con errores. Corríjalas: no se importa parcialmente.',
                $resultado['resumen']['con_error']
            ));
        }

        return DB::transaction(function () use ($resultado) {
            $creados = 0;
            $actualizados = 0;

            foreach ($resultado['filas'] as $fila) {
                $centro = $this->centroDe($fila['area'], $fila['centro_costo']);

                $empleado = Empleado::updateOrCreate(
                    ['codigo' => $fila['codigo']],
                    [
                        'nombres'          => $fila['nombres'],
                        'apellido_paterno' => $fila['apellido_paterno'],
                        'apellido_materno' => $fila['apellido_materno'],
                        'ci'               => $fila['ci'],
                        'expedido'         => $fila['expedido'],
                        'tipo_documento'   => $fila['tipo_documento'],
                        'cargo'            => $fila['cargo'],
                        'profesion'        => $fila['profesion'],
                        'centro_costo_id'  => $centro->id,
                        'fecha_ingreso'    => $fila['fecha_ingreso'],
                        'telefono'         => $fila['telefono'],
                        'movil'            => $fila['movil'],
                        'email'            => $fila['email'],
                        'direccion'        => $fila['direccion'],
                        'observaciones'    => $fila['observaciones'],
                        'activo'           => true,
                    ]
                );

                $empleado->wasRecentlyCreated ? $creados++ : $actualizados++;
            }

            return ['creados' => $creados, 'actualizados' => $actualizados];
        });
    }

    /**
     * El área y el centro se crean si no existen. Quedan sin almacén: hay que
     * asignárselo después desde la pantalla de centros, porque es lo que
     * define quién ve esos bienes.
     */
    private function centroDe(string $areaCodigo, string $centroCodigo): CentroCosto
    {
        $area = Area::firstOrCreate(
            ['codigo' => $areaCodigo],
            ['nombre' => $areaCodigo, 'activo' => true]
        );

        return CentroCosto::firstOrCreate(
            ['codigo' => $centroCodigo],
            ['area_id' => $area->id, 'nombre' => $centroCodigo, 'activo' => true]
        );
    }

    // ───────────────────────────────────────────────────────── Lectura

    private function leer(string $ruta, string $extension = 'xlsx'): array
    {
        // La ruta temporal de PHP no tiene extensión, así que hay que decirle
        // explícitamente qué formato leer.
        $tipo = match (strtolower($extension)) {
            'xls' => \Maatwebsite\Excel\Excel::XLS,
            'csv' => \Maatwebsite\Excel\Excel::CSV,
            default => \Maatwebsite\Excel\Excel::XLSX,
        };
        $hoja = Excel::toCollection(null, $ruta, null, $tipo)->first() ?? collect();

        $indices = $this->ubicarColumnas($hoja);

        if (! isset($indices['codigo'], $indices['nombres'], $indices['ci'])) {
            throw new RuntimeException(
                'No se encontraron las columnas mínimas: Código, Nombre y C.I. '
                .'¿Es el formato de importación de empleados?'
            );
        }

        $filas = [];

        foreach ($hoja->skip(1) as $n => $cruda) {
            $v = fn (string $campo) => isset($indices[$campo])
                ? trim((string) ($cruda[$indices[$campo]] ?? ''))
                : '';

            // El formato trae filas con área y centro precargados pero sin
            // persona: se ignoran.
            if (blank($v('codigo')) && blank($v('nombres')) && blank($v('ci'))) {
                continue;
            }

            $nombres = trim($v('nombres') . ' ' . $v('segundo_nombre'));

            $filas[] = [
                'numero'           => $n + 1,
                'codigo'           => $v('codigo'),
                'nombres'          => $nombres,
                'apellido_paterno' => $v('apellido_paterno') ?: null,
                'apellido_materno' => $v('apellido_materno') ?: null,
                'ci'               => $v('ci'),
                'expedido'         => $v('expedido') ?: null,
                'tipo_documento'   => $v('tipo_documento') ?: null,
                'cargo'            => $v('cargo') ?: null,
                'profesion'        => $v('profesion') ?: null,
                'area'             => strtoupper($v('area')),
                'centro_costo'     => strtoupper($v('centro_costo')),
                'fecha_ingreso'    => $this->fecha($cruda[$indices['fecha_ingreso']] ?? null),
                'telefono'         => $v('telefono') ?: null,
                'movil'            => $v('movil') ?: null,
                'email'            => $v('email') ?: null,
                'direccion'        => $v('direccion') ?: null,
                'observaciones'    => $v('observaciones') ?: null,
                'errores'          => [],
                'valida'           => true,
                'existe'           => false,
            ];
        }

        return $filas;
    }

    /** Ubica cada columna por su encabezado, tolerando variantes. */
    private function ubicarColumnas($hoja): array
    {
        $encabezado = $hoja->first();

        if (! $encabezado) {
            return [];
        }

        $indices = [];

        foreach ($encabezado as $i => $titulo) {
            $limpio = trim((string) $titulo);

            if ($limpio === '') {
                continue;
            }

            foreach (self::MAPA as $campo => $variantes) {
                foreach ($variantes as $variante) {
                    if (mb_strtolower($limpio) === mb_strtolower($variante)) {
                        $indices[$campo] ??= $i;
                    }
                }
            }
        }

        return $indices;
    }

    private function validarFilas(array &$filas): void
    {
        $codigosEnBase = Empleado::pluck('codigo')->flip();
        $cisEnBase     = Empleado::pluck('ci')->map(fn ($c) => strtoupper($c))->flip();

        $codigosArchivo = [];
        $cisArchivo     = [];

        foreach ($filas as &$f) {
            if (blank($f['codigo']))  $f['errores'][] = 'Falta el código.';
            if (blank($f['nombres'])) $f['errores'][] = 'Falta el nombre.';
            if (blank($f['ci']))      $f['errores'][] = 'Falta el C.I.';
            if (blank($f['area']))    $f['errores'][] = 'Falta el área.';
            if (blank($f['centro_costo'])) $f['errores'][] = 'Falta el centro de costo.';

            // Duplicados dentro del archivo: el error más común al copiar filas.
            if ($f['codigo'] !== '') {
                if (isset($codigosArchivo[$f['codigo']])) {
                    $f['errores'][] = "Código repetido en el archivo (fila {$codigosArchivo[$f['codigo']]}).";
                } else {
                    $codigosArchivo[$f['codigo']] = $f['numero'];
                }
            }

            $ci = strtoupper($f['ci']);

            if ($ci !== '') {
                if (isset($cisArchivo[$ci])) {
                    $f['errores'][] = "C.I. repetido en el archivo (fila {$cisArchivo[$ci]}).";
                } else {
                    $cisArchivo[$ci] = $f['numero'];
                }

                // Un CI ya registrado con OTRO código es un conflicto real.
                if ($cisEnBase->has($ci) && ! $codigosEnBase->has($f['codigo'])) {
                    $f['errores'][] = "El C.I. {$f['ci']} ya está registrado con otro código.";
                }
            }

            // Reimportar actualiza, no duplica.
            $f['existe'] = $codigosEnBase->has($f['codigo']);
            $f['valida'] = empty($f['errores']);
        }
    }

    private function fecha($valor): ?string
    {
        if (blank($valor)) {
            return null;
        }

        if (is_numeric($valor)) {
            try {
                return Carbon::instance(
                    \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($valor)
                )->toDateString();
            } catch (\Throwable) {
                return null;
            }
        }

        foreach (['d/m/Y', 'Y-m-d', 'd-m-Y'] as $formato) {
            try {
                return Carbon::createFromFormat($formato, trim((string) $valor))->toDateString();
            } catch (\Throwable) {
                continue;
            }
        }

        return null;
    }
}
