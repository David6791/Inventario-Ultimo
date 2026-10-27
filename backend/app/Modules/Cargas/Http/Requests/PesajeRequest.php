<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\Pesaje;
use Illuminate\Validation\Rule;

/**
 * Pesaje de báscula. En un pesaje de ingreso el chofer es obligatorio: es
 * quien cobra el bono y firma la boleta.
 */
class PesajeRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.recibir';

    /** Prefijo de los campos: «pesaje.» cuando viene dentro de la recepción del lote. */
    protected string $prefijo = '';

    protected function prepareForValidation(): void
    {
        $this->limpiarPesaje($this->prefijo);
    }

    protected function limpiarPesaje(string $p): void
    {
        $datos = $p === '' ? $this->all() : (array) $this->input(rtrim($p, '.'), []);
        if (! $datos) {
            return;
        }
        // Ticket, placa y CI sin espacios; báscula y chofer con un solo espacio. Todo en mayúsculas.
        foreach (['ticket' => '', 'numero_orden' => '', 'placa' => '', 'chofer_ci' => '', 'bascula' => ' ', 'chofer_nombre' => ' '] as $c => $sep) {
            if (isset($datos[$c]) && is_string($datos[$c])) {
                $datos[$c] = mb_strtoupper(preg_replace('/\s+/u', $sep, trim($datos[$c]))) ?: null;
            }
        }
        $datos['tipo'] = $datos['tipo'] ?? 'INGRESO';
        $datos['peso_cliente_tipo'] = $datos['peso_cliente_tipo'] ?? 'NETO';
        $p === '' ? $this->merge($datos) : $this->merge([rtrim($p, '.') => $datos]);
    }

    public static function reglas(string $p = '', bool $obligatorio = true): array
    {
        $req = $obligatorio ? 'required' : "required_with:{$p}peso_bruto_kg";

        return [
            "{$p}tipo"          => ['nullable', Rule::in(Pesaje::TIPOS)],
            "{$p}bascula"       => [$req, 'string', 'max:40'],
            "{$p}ticket"        => [$req, 'string', 'max:30'],
            "{$p}peso_bruto_kg" => [$obligatorio ? 'required' : 'nullable', 'numeric', 'gt:0', 'max:9999999', 'decimal:0,2'],
            "{$p}tara_kg"       => [$req, 'numeric', 'min:0', "lt:{$p}peso_bruto_kg", 'decimal:0,2'],
            "{$p}peso_cliente_kg" => ['nullable', 'numeric', 'gt:0', 'max:9999999', 'decimal:0,2'],
            "{$p}peso_cliente_tipo" => ['nullable', Rule::in(['NETO', 'BRUTO'])],
            "{$p}num_sacos"     => ['nullable', 'integer', 'min:0', 'max:100000'],
            "{$p}placa"         => ['nullable', 'string', 'max:15'],
            "{$p}chofer_nombre" => ["required_if:{$p}tipo,INGRESO", 'nullable', 'string', 'max:150'],
            "{$p}chofer_ci"     => ['nullable', 'string', 'max:15'],
            "{$p}numero_orden"  => ['nullable', 'string', 'max:30'],
            "{$p}fecha_ticket"  => ['nullable', 'date', 'before_or_equal:' . now()->addDay()->toDateString(), 'after:2020-01-01'],
            "{$p}foto_interior_id" => [self::fotoObligatoria() ? "required_with:{$p}peso_bruto_kg" : 'nullable', 'nullable', 'integer',
                                       self::fotoSuelta('TICKET_INTERIOR')],
            "{$p}foto_exterior_id" => ['nullable', 'integer', self::fotoSuelta('TICKET_EXTERIOR')],
        ];
    }

    /** Parámetro FOTO_TICKET_OBLIGATORIA: el pesaje de báscula exige la foto del ticket interior. */
    public static function fotoObligatoria(): bool
    {
        return mb_strtoupper((string) app(\App\Modules\Cargas\Services\ParametroService::class)
            ->vigente('FOTO_TICKET_OBLIGATORIA')?->valor) !== 'NO';
    }

    /** Foto de ese tipo, subida por este usuario y que todavía no es de ningún pesaje. */
    public static function fotoSuelta(string $tipo): \Illuminate\Validation\Rules\Exists
    {
        return Rule::exists(\App\Modules\Cargas\Models\RecepcionFoto::class, 'id')
            ->where('tipo', $tipo)->whereNull('pesaje_id')->whereNull('pesaje_saco_id')
            ->where('subida_por', auth()->id());
    }

    public static function mensajes(string $p = ''): array
    {
        return [
            "{$p}tara_kg.lt"                => 'La tara debe ser menor que el peso bruto.',
            "{$p}chofer_nombre.required_if" => 'Indique el chofer: firma la boleta y cobra el bono.',
            "{$p}ticket.required"           => 'Indique el número de ticket de la báscula.',
            "{$p}ticket.required_with"      => 'Indique el número de ticket de la báscula.',
            "{$p}bascula.required_with"     => 'Indique la báscula.',
            "{$p}tara_kg.required_with"     => 'Indique la tara.',
            "{$p}peso_cliente_kg.gt"        => 'El peso del cliente debe ser mayor que cero; déjelo vacío si no lo declaró.',
            "{$p}fecha_ticket.before_or_equal" => 'La fecha de la boleta no puede ser posterior a mañana: revísela.',
            "{$p}fecha_ticket.after"        => 'La fecha de la boleta no es válida: revísela.',
            "{$p}foto_interior_id.required_with" => 'Suba la foto del ticket de la báscula interior: es el respaldo del pesaje.',
            "{$p}foto_interior_id.exists"   => 'La foto del ticket interior no es válida o ya está en otro pesaje: tómela de nuevo.',
            "{$p}foto_exterior_id.exists"   => 'La foto del ticket exterior no es válida o ya está en otro pesaje: tómela de nuevo.',
        ];
    }

    public function rules(): array
    {
        return self::reglas();
    }

    public function messages(): array
    {
        return self::mensajes();
    }
}
