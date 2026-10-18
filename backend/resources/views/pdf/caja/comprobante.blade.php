{{--
  Comprobante de caja: original y copia en una hoja carta, separados por una
  línea de corte. El original queda con quien recibe o entrega el dinero; la
  copia se archiva con el cierre de caja.

  Sin color de fondo ni floats (dompdf los resuelve mal); DejaVu porque es la
  única familia de dompdf con acentos completos.
--}}
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>{{ $mov->numero }}</title>
  <style>
    @page { margin: 1.1cm 1.4cm; }
    body { font-family: "DejaVu Sans", sans-serif; font-size: 8.5pt; color: #000; line-height: 1.3; }

    .tanto { height: 12.1cm; position: relative; }
    .corte { border-top: .6pt dashed #777; margin: 3mm 0 4mm; text-align: center;
             font-size: 6.5pt; color: #777; letter-spacing: .1em; }

    table { border-collapse: collapse; width: 100%; }
    td { padding: 0; vertical-align: top; }

    .institucion { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: .04em; }
    .sede { font-size: 7pt; color: #333; }
    .titulo { font-size: 11.5pt; font-weight: bold; letter-spacing: .08em; text-align: right; }
    .numero { font-size: 11pt; font-weight: bold; text-align: right; font-family: "DejaVu Sans Mono", monospace; }
    .tanto-de { font-size: 6.5pt; text-align: right; text-transform: uppercase; letter-spacing: .08em; color: #333; }

    .regla { border-top: 1.2pt solid #000; margin: 2mm 0 3mm; }

    .monto-caja { border: 1pt solid #000; padding: 1.6mm 2.5mm; text-align: right; }
    .monto-caja .rotulo { font-size: 6.5pt; text-transform: uppercase; letter-spacing: .05em; color: #333; text-align: left; }
    .monto-caja .cifra { font-size: 13pt; font-weight: bold; font-family: "DejaVu Sans Mono", monospace; }

    table.datos td { padding: 1.1mm 0; }
    table.datos .rotulo { width: 27mm; font-size: 6.8pt; text-transform: uppercase; letter-spacing: .03em; color: #333; padding-top: 1.6mm; }
    table.datos .valor { border-bottom: .4pt dotted #666; }

    .letras { margin: 2.5mm 0; padding: 1.6mm 2.5mm; border: .4pt solid #999; font-size: 8pt; }
    .letras b { font-size: 6.8pt; letter-spacing: .04em; }

    .sello-anulado { border: 1.5pt solid #000; padding: 1.5mm 3mm; margin-bottom: 2mm; font-size: 8pt; }
    .sello-anulado b { font-size: 9pt; letter-spacing: .1em; }

    table.firmas { position: absolute; bottom: 13mm; left: 0; right: 0; }
    table.firmas td { width: 50%; text-align: center; padding: 0 8mm; vertical-align: bottom; }
    .linea-firma { border-top: .6pt solid #000; padding-top: 1.2mm; font-size: 7.5pt; }
    .cargo { font-size: 6.5pt; color: #333; }

    .pie { position: absolute; bottom: -1mm; left: 0; right: 0; font-size: 6pt; color: #555; }
  </style>
</head>
<body>
@php
  $esIngreso = $mov->tipo === 'INGRESO';
  $simbolo   = $mov->moneda === 'USD' ? 'US$' : 'Bs';
  $monto     = number_format((float) $mov->monto, 2, ',', '.');
  $formaPago = match ($mov->forma_pago) {
      'CHEQUE'        => 'Cheque',
      'TRANSFERENCIA' => 'Transferencia',
      default         => 'Efectivo',
  };
@endphp

@foreach (['Original', 'Copia — archivo de caja'] as $i => $tanto)
  @if ($i > 0)
    <div class="corte">✂ · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·</div>
  @endif

  <div class="tanto">
    <table>
      <tr>
        <td>
          <div class="institucion">{{ $institucion }}</div>
          <div class="sede">Caja {{ $mov->caja->codigo }} — {{ $mov->caja->nombre }} · {{ $mov->caja->almacen?->nombre }}</div>
        </td>
        <td style="width: 95mm;">
          <div class="titulo">COMPROBANTE DE {{ $esIngreso ? 'INGRESO' : 'EGRESO' }}</div>
          <div class="numero">N.º {{ $mov->numero }}</div>
          <div class="tanto-de">{{ $tanto }}</div>
        </td>
      </tr>
    </table>

    <div class="regla"></div>

    @if ($mov->estado === 'ANULADO')
      <div class="sello-anulado">
        <b>ANULADO</b> — sin valor. El {{ $mov->anulado_en?->format('d/m/Y H:i') }} por {{ $mov->anuladoPor?->name }}: {{ $mov->motivo_anulacion }}
      </div>
    @endif

    <table>
      <tr>
        <td>
          <table class="datos">
            <tr>
              <td class="rotulo">Fecha</td>
              <td class="valor">{{ $mov->fecha?->format('d/m/Y H:i') }}</td>
            </tr>
            <tr>
              <td class="rotulo">{{ $esIngreso ? 'Recibido de' : 'Pagado a' }}</td>
              <td class="valor">{{ $mov->persona_nombre }}@if ($mov->persona_ci) · CI {{ $mov->persona_ci }}@endif</td>
            </tr>
            <tr>
              <td class="rotulo">Concepto</td>
              <td class="valor">{{ $mov->concepto?->nombre }}</td>
            </tr>
            <tr>
              <td class="rotulo">Forma de pago</td>
              <td class="valor">
                {{ $formaPago }}
                @if ($mov->forma_pago !== 'EFECTIVO')
                  · {{ $mov->banco?->nombre }} · N.º {{ $mov->nro_documento }}
                @endif
              </td>
            </tr>
          </table>
        </td>
        <td style="width: 52mm; padding-left: 6mm;">
          <div class="monto-caja">
            <div class="rotulo">Monto</div>
            <div class="cifra">{{ $simbolo }} {{ $monto }}</div>
          </div>
        </td>
      </tr>
    </table>

    <div class="letras"><b>SON:</b> {{ $enLetras }}</div>

    <table class="datos">
      <tr>
        <td class="rotulo">Glosa</td>
        <td class="valor">{{ $mov->glosa }}</td>
      </tr>
    </table>

    <table class="firmas">
      <tr>
        <td>
          <div class="linea-firma">
            {{ $mov->registradoPor?->name }}
            <div class="cargo">{{ $esIngreso ? 'Recibí conforme' : 'Entregué conforme' }} — Cajero</div>
          </div>
        </td>
        <td>
          <div class="linea-firma">
            {{ $mov->persona_nombre }}
            <div class="cargo">{{ $esIngreso ? 'Entregué conforme' : 'Recibí conforme' }}@if ($mov->persona_ci) — CI {{ $mov->persona_ci }}@endif</div>
          </div>
        </td>
      </tr>
    </table>

    <div class="pie">Sesión {{ $mov->sesion?->numero }} · Registrado por {{ $mov->registradoPor?->name }} · Impreso el {{ now()->format('d/m/Y H:i') }}</div>
  </div>
@endforeach
</body>
</html>
