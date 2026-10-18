{{--
  Libro de caja por rango de fechas (carta horizontal). Los anulados, si se
  pidieron, salen tachados y no suman.
--}}
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Libro de caja</title>
  <style>
    @page { margin: 1.2cm 1.2cm 1.6cm 1.2cm; }
    body { font-family: "DejaVu Sans", sans-serif; font-size: 7.4pt; color: #000; line-height: 1.25; }
    table { border-collapse: collapse; width: 100%; }
    td, th { vertical-align: top; }
    .institucion { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: .04em; }
    .titulo { font-size: 11pt; font-weight: bold; letter-spacing: .05em; margin-top: 1mm; }
    .sub { font-size: 8pt; margin-bottom: 3mm; }
    h2 { font-size: 8pt; text-transform: uppercase; letter-spacing: .05em; margin: 4mm 0 1.5mm;
         border-bottom: .5pt solid #000; padding-bottom: .6mm; }
    table.grilla th { border: .5pt solid #000; background: #eee; padding: .9mm 1mm; font-size: 6.3pt;
                      text-transform: uppercase; text-align: left; }
    table.grilla td { border: .4pt solid #888; padding: .7mm 1mm; }
    .num { text-align: right; white-space: nowrap; font-family: "DejaVu Sans Mono", monospace; font-size: 7pt; }
    th.num { text-align: right; font-family: "DejaVu Sans", sans-serif; }
    .pequeno { font-size: 6.2pt; color: #444; }
    .anulado td { color: #777; }
    .anulado .num { text-decoration: line-through; }
    .total td { border-top: 1pt solid #000; font-weight: bold; background: #f4f4f4; }
    .pie { position: fixed; bottom: -0.9cm; left: 0; right: 0; height: .5cm; font-size: 6pt; color: #555;
           border-top: .3pt solid #999; padding-top: .8mm; }
  </style>
</head>
<body>
@php
  $d = fn ($v) => $v === null || (float) $v == 0 ? '' : number_format((float) $v, 2, ',', '.');
  $t = $libro->totales;
  $sim = $t['moneda'] === 'USD' ? 'US$' : 'Bs';
  $forma = ['EFECTIVO' => 'Efectivo', 'CHEQUE' => 'Cheque', 'TRANSFERENCIA' => 'Transf.'];
@endphp

<div class="institucion">{{ $institucion }}</div>
<div class="titulo">LIBRO DE CAJA</div>
<div class="sub">{{ $libro->titulo() }} · {{ $t['moneda'] === 'USD' ? 'Dólares (US$)' : 'Bolivianos (Bs)' }}</div>

<table class="grilla">
  <thead>
    <tr>
      <th rowspan="2" style="width: 15mm">Fecha</th>
      <th rowspan="2" style="width: 25mm">Comprobante</th>
      <th rowspan="2">Concepto · glosa</th>
      <th rowspan="2" style="width: 45mm">Persona</th>
      <th rowspan="2" style="width: 18mm">Forma</th>
      <th colspan="2" style="text-align: center">Efectivo</th>
      <th colspan="2" style="text-align: center">Cheque / transferencia</th>
    </tr>
    <tr>
      <th class="num" style="width: 21mm">Ingreso</th><th class="num" style="width: 21mm">Egreso</th>
      <th class="num" style="width: 21mm">Ingreso</th><th class="num" style="width: 21mm">Egreso</th>
    </tr>
  </thead>
  <tbody>
    @forelse ($libro->movimientos as $m)
      @php $ef = $m->forma_pago === 'EFECTIVO'; $ing = $m->tipo === 'INGRESO'; @endphp
      <tr class="{{ $m->estado === 'ANULADO' ? 'anulado' : '' }}">
        <td>{{ $m->fecha?->format('d/m/Y') }}<div class="pequeno">{{ $m->fecha?->format('H:i') }}</div></td>
        <td class="num" style="text-align: left">{{ $m->numero }}<div class="pequeno">Caja {{ $m->caja?->codigo }} · ses. {{ $m->sesion?->numero }}</div></td>
        <td>
          {{ $m->concepto?->nombre }}
          <div class="pequeno">{{ $m->glosa }}</div>
          @if ($m->estado === 'ANULADO')<div class="pequeno"><b>ANULADO:</b> {{ $m->motivo_anulacion }}</div>@endif
        </td>
        <td>{{ $m->persona_nombre }}@if ($m->persona_ci)<div class="pequeno">CI {{ $m->persona_ci }}</div>@endif</td>
        <td>{{ $forma[$m->forma_pago] ?? $m->forma_pago }}@if ($m->banco)<div class="pequeno">{{ $m->banco->nombre }} {{ $m->nro_documento }}</div>@endif</td>
        <td class="num">{{ $ef && $ing ? $d($m->monto) : '' }}</td>
        <td class="num">{{ $ef && ! $ing ? $d($m->monto) : '' }}</td>
        <td class="num">{{ ! $ef && $ing ? $d($m->monto) : '' }}</td>
        <td class="num">{{ ! $ef && ! $ing ? $d($m->monto) : '' }}</td>
      </tr>
    @empty
      <tr><td colspan="9">Sin movimientos en el rango elegido.</td></tr>
    @endforelse
    <tr class="total">
      <td colspan="5">Totales ({{ $t['movimientos'] }} movimientos vigentes)</td>
      <td class="num">{{ number_format($t['ingresos_efectivo'], 2, ',', '.') }}</td>
      <td class="num">{{ number_format($t['egresos_efectivo'], 2, ',', '.') }}</td>
      <td class="num">{{ number_format($t['ingresos_otras'], 2, ',', '.') }}</td>
      <td class="num">{{ number_format($t['egresos_otras'], 2, ',', '.') }}</td>
    </tr>
  </tbody>
</table>
<p class="pequeno">Neto en efectivo del período (ingresos − egresos): {{ $sim }} {{ number_format($t['neto_efectivo'], 2, ',', '.') }}.</p>

<h2>Resumen por concepto</h2>
<table class="grilla" style="width: 60%">
  <thead>
    <tr><th style="width: 16mm">Tipo</th><th>Concepto</th><th class="num">N.º</th><th class="num">Efectivo</th><th class="num">Otras formas</th><th class="num">Total</th></tr>
  </thead>
  <tbody>
    @foreach ($libro->porConcepto as $c)
      <tr>
        <td>{{ $c['tipo'] === 'INGRESO' ? 'Ingreso' : 'Egreso' }}</td>
        <td>{{ $c['concepto'] }}</td>
        <td class="num">{{ $c['movimientos'] }}</td>
        <td class="num">{{ number_format($c['efectivo'], 2, ',', '.') }}</td>
        <td class="num">{{ number_format($c['otras'], 2, ',', '.') }}</td>
        <td class="num"><b>{{ number_format($c['total'], 2, ',', '.') }}</b></td>
      </tr>
    @endforeach
  </tbody>
</table>

<div class="pie">Libro de caja {{ $libro->titulo() }} · impreso el {{ now()->format('d/m/Y H:i') }}</div>
</body>
</html>
