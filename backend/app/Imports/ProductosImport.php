<?php

namespace App\Imports;

use App\Models\Categoria;
use App\Models\Producto;
use App\Models\UnidadMedida;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\SkipsUnknownSheets;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Lee la plantilla de productos y decide si se puede importar.
 *
 * TODO O NADA. Se revisa el archivo completo antes de escribir una sola fila.
 * Si algo falla, no se importa nada y se devuelven todos los errores con su
 * número de fila.
 *
 * Una importación parcial deja el catálogo en un estado que nadie puede
 * reconstruir: ¿cuáles entraron?, ¿desde dónde sigo? Es preferible corregir el
 * archivo y volver a subirlo.
 */
class ProductosImport implements ToCollection, WithHeadingRow, WithMultipleSheets, SkipsUnknownSheets
{
    public function sheets(): array
    {
        return ['Productos' => $this];
    }
    public function onUnknownSheet($nombreHoja)
    {
        // Las demas hojas de la plantilla se ignoran sin error.
    }
    /** @var list<array{fila: int, columna: string, mensaje: string}> */
    public array $errores = [];

    /** @var list<array> filas listas para escribir */
    public array $paraCrear = [];

    /** @var list<array> filas que actualizan un producto existente */
    public array $paraActualizar = [];

    private Collection $categorias;
    private Collection $unidades;

    /** Códigos vistos en el propio archivo, para detectar duplicados internos. */
    private array $codigosDelArchivo = [];
    private array $nombresDelArchivo = [];

    public function __construct()
    {
        $this->categorias = Categoria::pluck('id', 'codigo');
        $this->unidades   = UnidadMedida::pluck('id', 'codigo');
    }

    public function collection(Collection $filas)
    {
        \Log::info('HOJA procesada', [
            'filas'    => $filas->count(),
            'columnas' => $filas->first() ? array_keys($filas->first()->toArray()) : [],
        ]);
        foreach ($filas as $indice => $fila) {
            if ($this->filaVacia($fila)) {
                continue;
            }

            $this->procesarFila($fila->toArray(), $indice + 2);
        }
    }

    private function filaVacia($fila): bool
    {
        return collect($fila)
            ->reject(fn ($valor) => is_null($valor) || trim((string) $valor) === '')
            ->isEmpty();
    }

    private function estaVacia($fila): bool
    {
        return collect($fila)->filter(fn ($v) => $v !== null && trim((string) $v) !== '')->isEmpty();
    }

    private function procesarFila(array $fila, int $numero): void
    {
        $codigo = $this->texto($fila['codigo'] ?? null);
        $nombre = $this->texto($fila['nombre'] ?? null);
        
        // --- Nombre ---
        if ($nombre === null) {
            $this->error($numero, 'Nombre', 'El nombre es obligatorio.');
            return;
        }

        if (mb_strlen($nombre) > 200) {
            $this->error($numero, 'Nombre', 'El nombre supera los 200 caracteres.');
        }

        $claveNombre = mb_strtolower($nombre);

        if (isset($this->nombresDelArchivo[$claveNombre])) {
            $this->error($numero, 'Nombre',
                "Este nombre ya aparece en la fila {$this->nombresDelArchivo[$claveNombre]} del archivo.");
        } else {
            $this->nombresDelArchivo[$claveNombre] = $numero;
        }

        // --- Categoría ---
        $categoriaCodigo = mb_strtoupper($this->texto($fila['categoria'] ?? null) ?? '');
        $categoriaId = $this->categorias[$categoriaCodigo] ?? null;

        if (! $categoriaId) {
            $this->error($numero, 'Categoría', $categoriaCodigo === ''
                ? 'La categoría es obligatoria. Use un código de la hoja "Categorias".'
                : "No existe la categoría «{$categoriaCodigo}». Revise la hoja \"Categorias\".");
        }

        // --- Unidad ---
        $unidadCodigo = mb_strtoupper($this->texto($fila['unidad'] ?? null) ?? '');
        $unidadId = $this->unidades[$unidadCodigo] ?? null;

        if (! $unidadId) {
            $this->error($numero, 'Unidad', $unidadCodigo === ''
                ? 'La unidad es obligatoria. Use un código de la hoja "Unidades".'
                : "No existe la unidad «{$unidadCodigo}». Revise la hoja \"Unidades\".");
        }

        // --- Cantidades ---
        $minimo = $this->numero($fila['stock_minimo'] ?? null, $numero, 'Stock mínimo');
        $maximo = $this->numero($fila['stock_maximo'] ?? null, $numero, 'Stock máximo');

        if ($maximo !== null && $minimo !== null && $maximo > 0 && $maximo < $minimo) {
            $this->error($numero, 'Stock máximo',
                "El máximo ({$maximo}) no puede ser menor que el mínimo ({$minimo}).");
        }

        // --- Código ---
        $existente = null;

        if ($codigo !== null) {
            $codigo = mb_strtoupper($codigo);

            if (mb_strlen($codigo) > 30) {
                $this->error($numero, 'Código', 'El código supera los 30 caracteres.');
            }

            if (isset($this->codigosDelArchivo[$codigo])) {
                $this->error($numero, 'Código',
                    "Este código ya aparece en la fila {$this->codigosDelArchivo[$codigo]} del archivo.");
            } else {
                $this->codigosDelArchivo[$codigo] = $numero;
            }

            // Un código existente NO es un error: actualiza ese producto.
            $existente = Producto::where('codigo', $fila['codigo'])->first();
        }

        // Si hubo errores en esta fila, no vale la pena armar los datos.
        if ($this->tieneErroresEn($numero)) {
            return;
        }

        $datos = [
            'codigo'                 => $codigo,
            'nombre'                 => $nombre,
            'descripcion'            => $this->texto($fila['descripcion'] ?? null),
            'categoria_id'           => $categoriaId,
            'unidad_medida_id'       => $unidadId,
            'stock_minimo'           => $minimo ?? 0,
            'stock_maximo'           => $maximo,
            'partida_presupuestaria' => $this->texto($fila['partida'] ?? null),
            'codigo_barras'          => $this->texto($fila['codigo_de_barras'] ?? null),
            'controla_lote'          => $this->siNo($fila['controla_lote'] ?? null),
            'controla_vencimiento'   => $this->siNo($fila['controla_vencimiento'] ?? null),
            'activo'                 => true,
            '_fila'                  => $numero,
            '_categoria_codigo'      => $categoriaCodigo,
        ];

        if ($existente) {
            $datos['_id'] = $existente->id;
            $this->paraActualizar[] = $datos;
        } else {
            $this->paraCrear[] = $datos;
        }
    }

    /**
     * Escribe todo en una transacción. Se llama solo si no hay errores.
     *
     * @return array{creados: int, actualizados: int}
     */
    public function guardar(): array
    {
        return DB::transaction(function () {
            $creados = 0;

            foreach ($this->paraCrear as $datos) {
                $fila = $this->limpiar($datos);

                // Sin código en la plantilla, se genera desde la categoría.
                $fila['codigo'] ??= $this->siguienteCodigo($datos['_categoria_codigo']);

                Producto::create($fila);
                $creados++;
            }

            $actualizados = 0;

            foreach ($this->paraActualizar as $datos) {
                $producto = Producto::withTrashed()->find($datos['_id']);

                if (! $producto) {
                    continue;
                }

                // Si estaba dado de baja, vuelve: quien lo incluye en la carga
                // lo está dando de alta otra vez.
                if ($producto->trashed()) {
                    $producto->restore();
                }

                $producto->update($this->limpiar($datos));
                $actualizados++;
            }

            return ['creados' => $creados, 'actualizados' => $actualizados];
        });
    }

    /** Quita los campos internos antes de escribir. */
    private function limpiar(array $datos): array
    {
        unset($datos['_fila'], $datos['_id'], $datos['_categoria_codigo']);

        return $datos;
    }

    /**
     * Siguiente código para una categoría: ESCR-0001, ESCR-0002...
     *
     * Se calcula sobre lo que ya hay en la base, incluidos los eliminados: un
     * código reutilizado chocaría con la restricción de unicidad.
     */
    private function siguienteCodigo(string $prefijo): string
    {
        $ultimo = Producto::withTrashed()
            ->where('codigo', 'like', $prefijo.'-%')
            ->orderByDesc('codigo')
            ->value('codigo');

        $numero = $ultimo ? ((int) substr($ultimo, strlen($prefijo) + 1)) + 1 : 1;

        // También hay que saltear los que esta misma carga va a ocupar.
        while (isset($this->codigosDelArchivo[sprintf('%s-%04d', $prefijo, $numero)])) {
            $numero++;
        }

        $codigo = sprintf('%s-%04d', $prefijo, $numero);
        $this->codigosDelArchivo[$codigo] = 0;

        return $codigo;
    }

    // --- Utilidades de lectura ---------------------------------------------

    private function texto($valor): ?string
    {
        if ($valor === null) {
            return null;
        }

        $texto = trim((string) $valor);

        return $texto === '' ? null : $texto;
    }

    private function numero($valor, int $fila, string $columna): ?float
    {
        $texto = $this->texto($valor);

        if ($texto === null) {
            return null;
        }

        // Excel en español escribe los decimales con coma.
        $normalizado = str_replace(',', '.', $texto);

        if (! is_numeric($normalizado)) {
            $this->error($fila, $columna, "«{$texto}» no es un número válido.");
            return null;
        }

        $numero = (float) $normalizado;

        if ($numero < 0) {
            $this->error($fila, $columna, 'No puede ser negativo.');
            return null;
        }

        return $numero;
    }

    private function siNo($valor): bool
    {
        $texto = mb_strtoupper($this->texto($valor) ?? '');

        return in_array($texto, ['SI', 'SÍ', 'S', 'X', '1', 'TRUE', 'VERDADERO'], true);
    }

    private function error(int $fila, string $columna, string $mensaje): void
    {
        $this->errores[] = compact('fila', 'columna', 'mensaje');
    }

    private function tieneErroresEn(int $fila): bool
    {
        foreach ($this->errores as $error) {
            if ($error['fila'] === $fila) {
                return true;
            }
        }

        return false;
    }
}
