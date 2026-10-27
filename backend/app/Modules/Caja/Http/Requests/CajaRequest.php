<?php

namespace App\Modules\Caja\Http\Requests;

use App\Models\Almacen;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Services\CajaService;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Alta y edición de una caja. El formato del comprobante se valida contra la
 * base (las mismas reglas que al numerar) y se rechaza si el próximo número ya
 * existe, cosa que pasa al volver a un formato usado antes.
 */
class CajaRequest extends FormularioCaja
{
    protected function prepareForValidation(): void
    {
        $this->mayusculas('codigo', 'reinicio_comprobante');
        $this->colapsarEspacios('nombre');
        if (is_string($this->input('formato_comprobante'))) {
            $this->merge(['formato_comprobante' => trim($this->input('formato_comprobante'))]);
        }
    }

    public function rules(): array
    {
        $id = $this->route('caja')?->id;

        return [
            'codigo'               => ['required', 'string', 'max:10', 'regex:/^[A-Z0-9]+$/',
                                       Rule::unique(Caja::class, 'codigo')->ignore($id)],
            'nombre'               => ['required', 'string', 'max:100'],
            'almacen_id'           => ['required', 'integer', Rule::exists(Almacen::class, 'id')],
            'maneja_usd'           => ['boolean'],
            'formato_comprobante'  => ['required', 'string', 'max:60'],
            'reinicio_comprobante' => ['required', Rule::in(Caja::REINICIOS)],
            'activa'               => ['boolean'],
            'requiere_aprobacion'  => ['boolean'],
            // Desde qué número sigue el comprobante (por ejemplo, continuar otro sistema).
            'proximo_comprobante'  => ['nullable', 'integer', 'min:1', 'max:99999999'],
            'motivo_numeracion'    => ['nullable', 'string', 'max:250'],
            // Numeración separada: egresos e ingresos con correlativo propio.
            'numeracion_separada'  => ['boolean'],
            'inicio_egreso'        => ['nullable', 'integer', 'min:1', 'max:99999999'],
            'inicio_ingreso'       => ['nullable', 'integer', 'min:1', 'max:99999999'],
            'formato_ingreso'      => ['nullable', 'string', 'max:60'],
            'proximo_ingreso'      => ['nullable', 'integer', 'min:1', 'max:99999999'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                /** @var Caja|null $caja */
                $caja = $this->route('caja');

                if ($caja?->tieneSesiones()) {
                    if ($this->input('codigo') !== $caja->codigo) {
                        $validator->errors()->add('codigo', 'La caja ya emitió comprobantes con este código: no se cambia.');
                    }
                    if ((int) $this->input('almacen_id') !== $caja->almacen_id) {
                        $validator->errors()->add('almacen_id', 'La caja ya tiene sesiones en su sede: no se cambia de sede. Cree otra caja.');
                    }
                    if ($validator->errors()->isNotEmpty()) {
                        return;
                    }
                }

                $sinCambioDeFormato = $caja
                    && $caja->formato_comprobante === $this->input('formato_comprobante')
                    && $caja->reinicio_comprobante === $this->input('reinicio_comprobante');

                $previa = app(CajaService::class)->vistaPrevia(
                    $this->only(['codigo', 'formato_comprobante', 'reinicio_comprobante']),
                    $caja
                );

                // Con numeración separada, «proximo_comprobante» es el de egresos.
                $separada = $this->boolean('numeracion_separada') && ($caja?->numeracion_separada ?? false);
                foreach (['proximo_comprobante' => $separada ? 'EGRESO' : null, 'proximo_ingreso' => 'INGRESO'] as $campo => $tipo) {
                    if (! $caja || ! $this->filled($campo) || ($campo === 'proximo_ingreso' && ! $separada)) {
                        continue;
                    }
                    $ultimo = app(\App\Modules\Caja\Services\SolicitudService::class)->ultimoComprobante($caja, $tipo);
                    $proximo = $this->integer($campo);
                    if ($proximo !== $ultimo + 1 && $proximo <= $ultimo) {
                        $validator->errors()->add($campo,
                            "La caja ya emitió hasta el correlativo {$ultimo}" . ($tipo ? ' de ' . mb_strtolower($tipo) . 's' : '')
                            . ": el próximo no puede ser {$proximo}, se repetirían números.");
                    }
                }

                if ($this->boolean('numeracion_separada') && filled($this->input('formato_ingreso'))) {
                    $previaIngreso = app(CajaService::class)->vistaPrevia(
                        ['codigo' => $this->input('codigo'), 'formato_comprobante' => $this->input('formato_ingreso'),
                         'reinicio_comprobante' => $this->input('reinicio_comprobante')], null);
                    if ($previaIngreso['error'] !== null) {
                        $validator->errors()->add('formato_ingreso', $previaIngreso['error']);
                    }
                }

                if ($previa['error'] !== null) {
                    $validator->errors()->add('formato_comprobante', $previa['error']);
                } elseif ($previa['repetido'] && ! $sinCambioDeFormato) {
                    $validator->errors()->add('formato_comprobante',
                        "Con este formato el próximo comprobante sería {$previa['numero']}, que ya existe. Use un formato distinto.");
                }
            },
        ];
    }

    /** Solo las columnas de la caja; la numeración se fija aparte. */
    public function datosCaja(): array
    {
        $datos = collect($this->validated())->except(['proximo_comprobante', 'motivo_numeracion', 'proximo_ingreso'])->all();
        foreach (['inicio_egreso', 'inicio_ingreso'] as $campo) {
            if (array_key_exists($campo, $datos) && $datos[$campo] === null) {
                unset($datos[$campo]);
            }
        }
        if (array_key_exists('formato_ingreso', $datos) && blank($datos['formato_ingreso'])) {
            $datos['formato_ingreso'] = null;
        }

        return $datos;
    }

    public function messages(): array
    {
        return [
            'codigo.regex'  => 'El código de caja va en mayúsculas y números, sin espacios ni guiones (por ejemplo PTS o PORCO).',
            'codigo.unique' => 'Ya existe una caja con ese código.',
            'proximo_comprobante.min' => 'El próximo comprobante debe ser un número mayor que cero.',
        ];
    }
}
