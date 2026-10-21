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

                if ($caja && $this->filled('proximo_comprobante')) {
                    $ultimo = app(\App\Modules\Caja\Services\SolicitudService::class)->ultimoComprobante($caja);
                    $proximo = $this->integer('proximo_comprobante');
                    if ($proximo !== $ultimo + 1 && $proximo <= $ultimo) {
                        $validator->errors()->add('proximo_comprobante',
                            "La caja ya emitió hasta el correlativo {$ultimo}: el próximo no puede ser {$proximo}, se repetirían números.");
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
        return collect($this->validated())->except(['proximo_comprobante', 'motivo_numeracion'])->all();
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
