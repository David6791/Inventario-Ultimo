{{--
  Reporte diario de caja (una sesión): resumen por moneda, por concepto,
  detalle de movimientos, arqueo y firmas. Se imprime al cerrar y se entrega
  con el efectivo; el supervisor firma al validar.

  Con la sesión abierta sale marcado como PRELIMINAR. Sin color de fondo ni
  floats (dompdf); DejaVu por los acentos.
--}}
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Caja {{ $sesion->caja->codigo }} — sesión {{ $sesion->numero }}</title>
  <style>
    @page { margin: 1.4cm 1.3cm 1.8cm 1.3cm; }
    body { font-family: "DejaVu Sans", sans-serif; font-size: 8pt; color: #000; line-height: 1.3; }
    table { border-collapse: collapse; width: 100%; }
    td, th { vertical-align: top; }

    .cabecera td { padding: 0; }
    .institucion { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: .04em; }
    .sede { font-size: 7pt; color: #333; }
    .titulo { font-size: 12pt; font-weight: bold; letter-spacing: .06em; text-align: right; }
    .subtitulo { font-size: 9pt; text-align: right; }
    .sello { display: inline-block; border: 1.2pt solid #000; padding: .6mm 2mm; font-size: 7.5pt;
             font-weight: bold; letter-spacing: .08em; text-transform: uppercase; margin-top: 1mm; }
    .regla { border-top: 1.2pt solid #000; margin: 2mm 0 3mm; }

    h2 { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .05em; margin: 4mm 0 1.5mm;
         border-bottom: .5pt solid #000; padding-bottom: .6mm; }

    table.datos td { padding: .6mm 0; }
    table.datos .rotulo { width: 22mm; font-size: 6.8pt; text-transform: uppercase; color: #333; padding-top: 1mm; }

    table.grilla th { border: .5pt solid #000; background: #eee; padding: 1mm 1.2mm; font-size: 6.6pt;
                      text-transform: uppercase; letter-spacing: .02em; text-align: left; }
    table.grilla td { border: .5pt solid #777; padding: .9mm 1.2mm; }
    .num { text-align: right; white-space: nowrap; font-family: "DejaVu Sans Mono", monospace; font-size: 7.5pt; }
    th.num { text-align: right; font-family: "DejaVu Sans", sans-serif; }
    .fuerte { font-weight: bold; }
    .anulado td { color: #666; }
    .anulado .num { text-decoration: line-through; }
    .nota { font-size: 6.8pt; color: #333; }
    .pequeno { font-size: 6.6pt; color: #444; }
    .total td { border-top: 1pt solid #000; font-weight: bold; }

    .observaciones { border: .5pt solid #777; padding: 1.5mm 2mm; min-height: 8mm; }

    table.firmas { margin-top: 16mm; }
    table.firmas td { width: 50%; text-align: center; padding: 0 10mm; vertical-align: bottom; }
    .linea-firma { border-top: .6pt solid #000; padding-top: 1.2mm; font-size: 7.5pt; }
    .cargo { font-size: 6.5pt; color: #333; }

    .pie { position: fixed; bottom: -1cm; left: 0; right: 0; height: .6cm; font-size: 6.2pt; color: #555;
           border-top: .3pt solid #999; padding-top: 1mm; }
  </style>
</head>
<body>
@include('pdf._marca_agua')
@php
  $dinero = fn ($v) => number_format((float) $v, 2, ',', '.');
  $simbolo = fn ($m) => $m === 'USD' ? 'US$' : 'Bs';
  $abierta = $sesion->estado === 'ABIERTA';
  $forma = ['EFECTIVO' => 'Efectivo', 'CHEQUE' => 'Cheque', 'TRANSFERENCIA' => 'Transf.'];
@endphp

<table class="cabecera">
  <tr>
    <td>
      @include('pdf._institucion')
      <div class="sede">Caja {{ $sesion->caja->codigo }} — {{ $sesion->caja->nombre }} · {{ $sesion->caja->almacen?->nombre }}</div>
    </td>
    <td style="width: 95mm;">
      <div class="titulo">REPORTE DIARIO DE CAJA</div>
      <div class="subtitulo">Sesión {{ $sesion->numero }} · {{ $sesion->abierta_en?->format('d/m/Y') }}</div>
      <div style="text-align: right;">
        @if ($abierta)
          <span class="sello">Preliminar — caja abierta</span>
        @elseif ($sesion->estado === 'VALIDADA')
          <span class="sello">Validado</span>
        @else
          <span class="sello">Cerrado — pendiente de validación</span>
        @endif
      </div>
    </td>
  </tr>
</table>
<div class="regla"></div>

<table class="datos">
  <tr>
    <td class="rotulo">Apertura</td>
    <td>{{ $sesion->abierta_en?->format('d/m/Y H:i') }} · {{ $sesion->abiertaPor?->name }}</td>
    <td class="rotulo">Cierre</td>
    <td>{{ $sesion->cerrada_en ? $sesion->cerrada_en->format('d/m/Y H:i') . ' · ' . $sesion->cerradaPor?->name : '—' }}</td>
    <td class="rotulo">Validación</td>
    <td>{{ $sesion->validada_en ? $sesion->validada_en->format('d/m/Y H:i') . ' · ' . $sesion->validadaPor?->name : '—' }}</td>
  </tr>
</table>

<h2>Resumen del efectivo</h2>
<table class="grilla">
  <thead>
    <tr>
      <th>Moneda</th>
      <th class="num">Saldo inicial</th>
      <th class="num">+ Ingresos</th>
      <th class="num">− Egresos</th>
      <th class="num">= Esperado</th>
      <th class="num">Contado</th>
      <th class="num">Diferencia</th>
    </tr>
  </thead>
  <tbody>
    @foreach ($saldos as $s)
      @php
        $esperado = $s['saldo_esperado'] ?? $s['saldo_efectivo_actual'];
        $dif = $s['diferencia'];
      @endphp
      <tr>
        <td>{{ $s['moneda'] === 'USD' ? 'Dólares (US$)' : 'Bolivianos (Bs)' }}</td>
        <td class="num">{{ $dinero($s['saldo_inicial']) }}</td>
        <td class="num">{{ $dinero($s['ingresos_efectivo']) }}</td>
        <td class="num">{{ $dinero($s['egresos_efectivo']) }}</td>
        <td class="num fuerte">{{ $dinero($esperado) }}</td>
        <td class="num">{{ $s['saldo_contado'] !== null ? $dinero($s['saldo_contado']) : '—' }}</td>
        <td class="num fuerte">
          @if ($dif === null) —
          @elseif ((float) $dif == 0) Cuadra
          @else {{ (float) $dif > 0 ? 'Sobra' : 'Falta' }} {{ $dinero(abs((float) $dif)) }}
          @endif
        </td>
      </tr>
      @if ((float) $s['ingresos_no_efectivo'] || (float) $s['egresos_no_efectivo'])
        <tr>
          <td colspan="7" class="pequeno">
            Cheques y transferencias (no entran en el efectivo): ingresos {{ $simbolo($s['moneda']) }} {{ $dinero($s['ingresos_no_efectivo']) }},
            egresos {{ $simbolo($s['moneda']) }} {{ $dinero($s['egresos_no_efectivo']) }}.
          </td>
        </tr>
      @endif
    @endforeach
  </tbody>
</table>

<h2>Por concepto</h2>
@if ($porConcepto->isEmpty())
  <p class="nota">Sin movimientos vigentes.</p>
@else
  <table class="grilla">
    <thead>
      <tr>
        <th style="width: 16mm">Tipo</th>
        <th>Concepto</th>
        <th class="num" style="width: 12mm">N.º</th>
        <th class="num" style="width: 26mm">Efectivo</th>
        <th class="num" style="width: 26mm">Cheque / transf.</th>
        <th class="num" style="width: 28mm">Total</th>
      </tr>
    </thead>
    <tbody>
      @foreach ($porConcepto as $c)
        <tr>
          <td>{{ $c['tipo'] === 'INGRESO' ? 'Ingreso' : 'Egreso' }}</td>
          <td>{{ $c['concepto'] }}</td>
          <td class="num">{{ $c['movimientos'] }}</td>
          <td class="num">{{ $dinero($c['efectivo']) }}</td>
          <td class="num">{{ $dinero($c['otras_formas']) }}</td>
          <td class="num fuerte">{{ $simbolo($c['moneda']) }} {{ $dinero($c['total']) }}</td>
        </tr>
      @endforeach
    </tbody>
  </table>
@endif

<h2>Detalle de movimientos ({{ $movimientos->count() }})</h2>
<table class="grilla">
  <thead>
    <tr>
      <th style="width: 27mm">Comprobante</th>
      <th style="width: 10mm">Hora</th>
      <th>Concepto · persona</th>
      <th style="width: 15mm">Forma</th>
      <th class="num" style="width: 24mm">Ingreso</th>
      <th class="num" style="width: 24mm">Egreso</th>
    </tr>
  </thead>
  <tbody>
    @forelse ($movimientos as $m)
      <tr class="{{ $m->estado === 'ANULADO' ? 'anulado' : '' }}">
        <td class="num" style="text-align: left;">{{ $m->numero }}</td>
        <td>{{ $m->fecha?->format('H:i') }}</td>
        <td>
          {{ $m->concepto?->nombre }} · {{ $m->persona_nombre }}
          <div class="pequeno">{{ $m->glosa }}</div>
          @if ($m->estado === 'ANULADO')
            <div class="pequeno"><b>ANULADO</b> por {{ $m->anuladoPor?->name }}: {{ $m->motivo_anulacion }}</div>
          @endif
        </td>
        <td>{{ $forma[$m->forma_pago] ?? $m->forma_pago }}@if ($m->banco)<div class="pequeno">{{ $m->banco->nombre }} {{ $m->nro_documento }}</div>@endif</td>
        <td class="num">{{ $m->tipo === 'INGRESO' ? $simbolo($m->moneda) . ' ' . $dinero($m->monto) : '' }}</td>
        <td class="num">{{ $m->tipo === 'EGRESO' ? $simbolo($m->moneda) . ' ' . $dinero($m->monto) : '' }}</td>
      </tr>
    @empty
      <tr><td colspan="6" class="nota">Sin movimientos.</td></tr>
    @endforelse
  </tbody>
</table>
<p class="nota">Los comprobantes anulados se listan tachados y no suman en los totales.</p>

@if ($sesion->arqueo->isNotEmpty())
  <h2>Arqueo</h2>
  <table>
    <tr>
      @foreach ($sesion->arqueo->groupBy('moneda') as $moneda => $cortes)
        <td style="width: 50%; padding-right: 6mm;">
          <table class="grilla">
            <thead>
              <tr><th>Corte ({{ $simbolo($moneda) }})</th><th class="num">Cantidad</th><th class="num">Subtotal</th></tr>
            </thead>
            <tbody>
              @foreach ($cortes as $c)
                <tr>
                  <td class="num" style="text-align: left;">{{ $dinero($c->denominacion) }}</td>
                  <td class="num">{{ $c->cantidad }}</td>
                  <td class="num">{{ $dinero($c->subtotal) }}</td>
                </tr>
              @endforeach
              <tr class="total">
                <td colspan="2">Total contado</td>
                <td class="num">{{ $dinero($cortes->sum('subtotal')) }}</td>
              </tr>
            </tbody>
          </table>
        </td>
      @endforeach
    </tr>
  </table>
@endif

<h2>Observaciones</h2>
<div class="observaciones">{{ $sesion->observaciones ?: 'Sin observaciones.' }}</div>

<table class="firmas">
  <tr>
    <td>
      <div class="linea-firma">
        {{ $sesion->cerradaPor?->name ?? $sesion->abiertaPor?->name }}
        <div class="cargo">Cajero — entregué conforme</div>
      </div>
    </td>
    <td>
      <div class="linea-firma">
        {{ $sesion->validadaPor?->name }}
        <div class="cargo">Supervisor — revisé y recibí conforme</div>
      </div>
    </td>
  </tr>
</table>

<div class="pie">
  Caja {{ $sesion->caja->codigo }} · sesión {{ $sesion->numero }} · impreso el {{ now()->format('d/m/Y H:i') }}
</div>
</body>
</html>
