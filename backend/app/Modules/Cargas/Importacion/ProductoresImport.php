<?php

namespace App\Modules\Cargas\Importacion;

use App\Modules\Cargas\Models\Cooperativa;
use App\Modules\Cargas\Models\Productor;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\SkipsUnknownSheets;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Carga de productores desde Excel (hoja «Productores» de la plantilla).
 *
 * TODO O NADA, como la importación de productos: se revisa el archivo entero
 * y, si una sola fila tiene un error, no se escribe nada.
 *
 * Decisiones:
 *   - Un CI o NIT que ya existe NO es un error: esa fila ACTUALIZA al productor.
 *     Si el CI apunta a un productor y el NIT a otro, sí es un error.
 *   - La cooperativa se busca por nombre sin distinguir mayúsculas ni espacios
 *     de más; si no existe, se CREA. Las variantes de un mismo nombre en el
 *     archivo («Cerro Rico R.L.» y «CERRO RICO  R.L.») se unifican y se informan.
 *   - Tipo vacío: COOPERATIVISTA si trae cooperativa, PARTICULAR si no.
 *   - Dos productores con el mismo nombre y distinto documento NO se
 *     rechazan (pueden ser homónimos), pero se avisan.
 */
class ProductoresImport implements ToCollection, WithHeadingRow, WithMultipleSheets, SkipsUnknownSheets
{
    /** @var list<array{fila: int, columna: string, mensaje: string}> */
    public array $errores = [];

    /** @var list<array{fila: int, mensaje: string}> */
    public array $advertencias = [];

    /** @var list<array> */
    public array $paraCrear = [];

    /** @var list<array> */
    public array $paraActualizar = [];

    /** nombre normalizado => ['nombre' => como se creará, 'variantes' => [...], 'existe' => bool] */
    public array $cooperativas = [];

    private array $documentosDelArchivo = [];
    private array $nombresDelArchivo = [];

    public function sheets(): array
    {
        return ['Productores' => $this];
    }

    public function onUnknownSheet($nombreHoja)
    {
        // Instrucciones y listas de apoyo: se ignoran.
    }

    public function collection(Collection $filas)
    {
        foreach ($filas as $indice => $fila) {
            $datos = $fila->toArray();
            if ($this->filaVacia($datos)) {
                continue;
            }
            $this->procesarFila($datos, $indice + 2);
        }
    }

    private function procesarFila(array $fila, int $numero): void
    {
        $nombre      = $this->texto($fila['nombre'] ?? null, colapsar: true);
        $ci          = $this->documento($fila['ci'] ?? null);
        $nit         = $this->documento($fila['nit'] ?? null);
        $nim         = $this->documento($fila['nim'] ?? null);
        $cooperativa = $this->texto($fila['cooperativa'] ?? null, colapsar: true);
        $tipo        = mb_strtoupper($this->texto($fila['tipo'] ?? null) ?? '');

        if ($tipo === '') {
            $tipo = $cooperativa ? 'COOPERATIVISTA' : 'PARTICULAR';
        }

        // --- Campos ---
        if ($nombre === null) {
            $this->error($numero, 'Nombre', 'El nombre es obligatorio.');
        } elseif (mb_strlen($nombre) > 150) {
            $this->error($numero, 'Nombre', 'El nombre supera los 150 caracteres.');
        }

        if (! in_array($tipo, Productor::TIPOS, true)) {
            $this->error($numero, 'Tipo', "«{$tipo}» no es un tipo válido. Use: " . implode(', ', Productor::TIPOS) . '.');
        }

        if ($ci === null && $nit === null) {
            $this->error($numero, 'CI / NIT', 'Indique el CI o el NIT.');
        }

        foreach (['CI' => [$ci, 15], 'NIT' => [$nit, 20], 'NIM' => [$nim, 30]] as $columna => [$valor, $maximo]) {
            if ($valor !== null && mb_strlen($valor) > $maximo) {
                $this->error($numero, $columna, "El {$columna} supera los {$maximo} caracteres.");
            }
        }

        if ($tipo === 'COOPERATIVISTA' && $cooperativa === null) {
            $this->error($numero, 'Cooperativa', 'Un cooperativista debe indicar su cooperativa.');
        }
        if ($tipo !== 'COOPERATIVISTA' && $cooperativa !== null) {
            $this->error($numero, 'Cooperativa', "Solo un cooperativista lleva cooperativa (el tipo es {$tipo}).");
        }

        // --- Duplicados dentro del archivo ---
        foreach (['CI' => $ci, 'NIT' => $nit, 'NIM' => $nim] as $columna => $valor) {
            if ($valor === null) {
                continue;
            }
            $clave = "{$columna}:{$valor}";
            if (isset($this->documentosDelArchivo[$clave])) {
                $this->error($numero, $columna, "Este {$columna} ya aparece en la fila {$this->documentosDelArchivo[$clave]} del archivo.");
            } else {
                $this->documentosDelArchivo[$clave] = $numero;
            }
        }

        if ($this->tieneErroresEn($numero)) {
            return;
        }

        // --- Contra la base ---
        $porCi  = $ci  ? Productor::where('ci', $ci)->first()   : null;
        $porNit = $nit ? Productor::where('nit', $nit)->first() : null;

        if ($porCi && $porNit && $porCi->id !== $porNit->id) {
            $this->error($numero, 'CI / NIT',
                "El CI corresponde a «{$porCi->nombre}» y el NIT a «{$porNit->nombre}»: son productores distintos.");

            return;
        }

        $existente = $porCi ?? $porNit;

        if ($nim !== null) {
            $porNim = Productor::where('nim', $nim)->first();
            if ($porNim && $porNim->id !== $existente?->id) {
                $this->error($numero, 'NIM', "Ese NIM ya pertenece a «{$porNim->nombre}».");

                return;
            }
        }

        // --- Homónimos (aviso, no error) ---
        $claveNombre = Cooperativa::normalizar($nombre);
        if (isset($this->nombresDelArchivo[$claveNombre])) {
            $this->advertencias[] = ['fila' => $numero,
                'mensaje' => "«{$nombre}» también está en la fila {$this->nombresDelArchivo[$claveNombre]} con otro documento: revise que no sea la misma persona."];
        } else {
            $this->nombresDelArchivo[$claveNombre] = $numero;
        }

        $datos = [
            'tipo'      => $tipo,
            'nombre'    => $nombre,
            'ci'        => $ci,
            'nit'       => $nit,
            'nim'       => $nim,
            'telefono'  => $this->texto($fila['telefono'] ?? null),
            'domicilio' => $this->texto($fila['domicilio'] ?? null, colapsar: true),
            'activo'    => true,
            '_fila'        => $numero,
            '_cooperativa' => $cooperativa ? $this->registrarCooperativa($cooperativa) : null,
        ];

        if ($existente) {
            $datos['_id'] = $existente->id;
            $this->paraActualizar[] = $datos;
        } else {
            $this->paraCrear[] = $datos;
        }
    }

    private function registrarCooperativa(string $nombre): string
    {
        $clave = Cooperativa::normalizar($nombre);

        if (! isset($this->cooperativas[$clave])) {
            $existente = Cooperativa::conNombre($nombre)->first();
            $this->cooperativas[$clave] = [
                'nombre'    => $existente->nombre ?? $nombre,
                'id'        => $existente?->id,
                'variantes' => [],
            ];
        }

        if ($nombre !== $this->cooperativas[$clave]['nombre'] && ! in_array($nombre, $this->cooperativas[$clave]['variantes'], true)) {
            $this->cooperativas[$clave]['variantes'][] = $nombre;
        }

        return $clave;
    }

    /** Escribe todo en una transacción. Solo se llama si no hay errores. */
    public function guardar(): array
    {
        return Transaccion::delUsuarioActual(function () {
            $nuevas = 0;
            foreach ($this->cooperativas as $clave => $coop) {
                if ($coop['id'] === null) {
                    $this->cooperativas[$clave]['id'] = Cooperativa::create(['nombre' => $coop['nombre']])->id;
                    $nuevas++;
                }
            }

            foreach ($this->paraCrear as $datos) {
                Productor::create($this->limpiar($datos));
            }

            foreach ($this->paraActualizar as $datos) {
                Productor::whereKey($datos['_id'])->first()->update($this->limpiar($datos));
            }

            return [
                'creados'              => count($this->paraCrear),
                'actualizados'         => count($this->paraActualizar),
                'cooperativas_creadas' => $nuevas,
            ];
        });
    }

    private function limpiar(array $datos): array
    {
        $datos['cooperativa_id'] = $datos['_cooperativa'] ? $this->cooperativas[$datos['_cooperativa']]['id'] : null;

        return array_filter($datos, fn ($clave) => ! str_starts_with($clave, '_'), ARRAY_FILTER_USE_KEY);
    }

    // ------------------------------------------------------------- Utilidades

    private function texto(mixed $valor, bool $colapsar = false): ?string
    {
        if ($valor === null) {
            return null;
        }
        $texto = trim((string) $valor);
        if ($colapsar) {
            $texto = preg_replace('/\s+/u', ' ', $texto);
        }

        return $texto === '' ? null : $texto;
    }

    /** Excel guarda un CI numérico como número (1234567.0): se devuelve como texto sin decimales. */
    private function documento(mixed $valor): ?string
    {
        if (is_float($valor) && floor($valor) === $valor) {
            $valor = number_format($valor, 0, '', '');
        }
        $texto = $this->texto($valor, colapsar: true);

        return $texto === null ? null : mb_strtoupper($texto);
    }

    private function filaVacia(array $fila): bool
    {
        return collect($fila)->reject(fn ($v) => $v === null || trim((string) $v) === '')->isEmpty();
    }

    private function error(int $fila, string $columna, string $mensaje): void
    {
        $this->errores[] = ['fila' => $fila, 'columna' => $columna, 'mensaje' => $mensaje];
    }

    private function tieneErroresEn(int $fila): bool
    {
        return collect($this->errores)->contains('fila', $fila);
    }
}
