{{-- Resumen de cargas recibidas en un período, por clasificación (carta vertical). --}}
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Resumen de cargas</title>
  <style>
    @page { margin: 1.4cm 1.4cm 1.6cm 1.4cm; }
    body { font-family: "DejaVu Sans", sans-serif; font-size: 8pt; color: #000; line-height: 1.3; }
    table { border-collapse: collapse; width: 100%; }
    .institucion { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: .04em; }
    .titulo { font-size: 12pt; font-weight: bold; letter-spacing: .05em; margin-top: 1mm; }
    .sub { font-size: 8pt; margin-bottom: 3mm; }
    h2 { font-size: 8pt; text-transform: uppercase; letter-spacing: .05em; margin: 5mm 0 1.5mm; border-bottom: .5pt solid #000; padding-bottom: .6mm; }
    table.grilla th { border: .5pt solid #000; background: #eee; padding: 1mm; font-size: 6.8pt; text-transform: uppercase; text-align: left; }
    table.grilla td { border: .4pt solid #888; padding: .8mm 1mm; }
    .num { text-align: right; white-space: nowrap; font-family: "DejaVu Sans Mono", monospace; }
    th.num { text-align: right; font-family: "DejaVu Sans", sans-serif; }
    .barra { height: 2.2mm; background: #4b5563; }
    .tot td { font-weight: bold; }
    .kpi td { border: .5pt solid #000; padding: 2mm; width: 33%; }
    .kpi .v { font-size: 13pt; font-weight: bold; font-family: "DejaVu Sans Mono", monospace; }
  </style>
</head>
<body>
@include('pdf._marca_agua')
@php
  $d = $r->datos;
  $kg = fn ($v) => number_format((float) $v, 2, ',', '.');
  $max = fn ($items) => max(1, ...array_map(fn ($i) => $i['kg'], $items ?: [['kg' => 1]]));
@endphp
@include('pdf._institucion')
<div class="titulo">RESUMEN DE CARGAS RECIBIDAS</div>
<div class="sub">{{ $r->titulo() }} · peso que vale (húmedo), sin lotes anulados</div>

<table class="kpi"><tr>
  <td>Lotes<div class="v">{{ $d['totales']['lotes'] }}</div></td>
  <td>Kilos<div class="v">{{ $kg($d['totales']['kg']) }}</div></td>
  <td>De producción propia<div class="v">{{ $d['totales']['lotes_propios'] }}</div></td>
</tr></table>

@foreach ([['Por acopio', $d['por_acopio'], 'Acopio'], ['Por tipo de carga (serie)', $d['por_tipo'], 'Tipo'],
           ['Por material', $d['por_material'], 'Material'], ['Compra y producción propia', $d['por_origen'], 'Origen']] as [$titulo, $items, $cab])
  <h2>{{ $titulo }}</h2>
  @php $m = $max($items); @endphp
  <table class="grilla">
    <thead><tr><th>{{ $cab }}</th><th class="num" style="width: 16mm">Lotes</th><th class="num" style="width: 30mm">Kg</th><th style="width: 45mm"></th></tr></thead>
    <tbody>
      @forelse ($items as $i)
        <tr><td>{{ $cab === 'Tipo' ? $i['clave'] . ' · ' . $i['nombre'] : $i['nombre'] }}</td><td class="num">{{ $i['lotes'] }}</td>
            <td class="num">{{ $kg($i['kg']) }}</td><td><div class="barra" style="width: {{ round($i['kg'] / $m * 100) }}%"></div></td></tr>
      @empty
        <tr><td colspan="4">Sin cargas en el período.</td></tr>
      @endforelse
    </tbody>
  </table>
@endforeach

@if ($d['produccion_propia'])
  <h2>Producción de minas propias</h2>
  <table class="grilla">
    <thead><tr><th>Mina</th><th>Bocamina</th><th class="num" style="width: 16mm">Lotes</th><th class="num" style="width: 30mm">Kg</th></tr></thead>
    <tbody>@foreach ($d['produccion_propia'] as $i)
      <tr><td>{{ $i['mina'] }}</td><td>{{ $i['bocamina'] }}</td><td class="num">{{ $i['lotes'] }}</td><td class="num">{{ $kg($i['kg']) }}</td></tr>
    @endforeach</tbody>
  </table>
@endif
</body>
</html>
