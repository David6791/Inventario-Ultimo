{{--
  Rótulo de identificación del lote, carta apaisada. Se coloca junto a la
  carga física (en la ruma o en los sacos) para que se lea de lejos.
  - El código grande y el de barras (Code 128) identifican el lote.
  - El QR abre la verificación pública: quien lo escanea comprueba en su
    teléfono que el código, el productor, los sacos y el peso son los
    registrados y que el lote no está anulado.
--}}
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Rótulo {{ $lote->codigo }}</title>
  <style>
    @page { margin: 1cm 1.2cm; }
    body { font-family: "DejaVu Sans", sans-serif; color: #000; font-size: 11pt; line-height: 1.25; }
    table { border-collapse: collapse; width: 100%; }
    td { vertical-align: top; padding: 0; }
    .institucion { font-size: 11pt; font-weight: bold; text-transform: uppercase; letter-spacing: .05em; }
    .titulo { font-size: 15pt; font-weight: bold; letter-spacing: .12em; margin-top: 1mm; }
    .sede { font-size: 9pt; color: #333; }
    .linea { font-size: 10pt; text-align: right; color: #333; }
    .regla { border-top: 2pt solid #000; margin: 2.5mm 0 3mm; }
    .codigo { font-family: "DejaVu Sans Mono", monospace; font-size: 62pt; font-weight: bold; letter-spacing: .02em;
              text-align: center; line-height: 1.05; }
    .anulado { border: 3pt solid #000; text-align: center; font-size: 26pt; font-weight: bold; letter-spacing: .3em;
               padding: 1.5mm 0; margin: 2mm 0; }
    .anulado small { display: block; font-size: 9pt; letter-spacing: 0; font-weight: normal; }
    table.datos td { padding: 2mm 0; border-bottom: .5pt solid #999; }
    table.datos .rotulo { width: 42mm; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .05em; color: #333; padding-top: 2.4mm; }
    table.datos .valor { font-size: 15pt; font-weight: bold; }
    table.datos .valor.normal { font-size: 13pt; font-weight: normal; }
    .num { font-family: "DejaVu Sans Mono", monospace; }
    .qr { text-align: center; }
    .qr img { width: 72mm; height: 72mm; }
    .qr .leyenda { font-size: 10pt; font-weight: bold; margin-top: 1mm; }
    .qr .url { font-family: "DejaVu Sans Mono", monospace; font-size: 6.2pt; color: #333; word-wrap: break-word; margin-top: .8mm; }
    .barras { text-align: center; margin-top: 7mm; }
    .barras img { height: 24mm; max-width: 230mm; }
    .pie { font-size: 7.5pt; color: #333; text-align: center; margin-top: 1.5mm; }
  </style>
</head>
<body>
@php
  $kg = fn ($v) => number_format((float) $v, 2, ',', '.');
@endphp

<table>
  <tr>
    <td>
      @include('pdf._institucion')
      <div class="titulo">IDENTIFICACIÓN DE CARGA</div>
      <div class="sede">{{ $lote->almacen?->nombre }}</div>
    </td>
    <td class="linea" style="width: 90mm; vertical-align: bottom;">{{ $lote->linea?->nombre }}</td>
  </tr>
</table>
<div class="regla"></div>

<div class="codigo">{{ $lote->codigo }}</div>
@if ($lote->estado === 'ANULADO')
  <div class="anulado">ANULADO<small>{{ $lote->motivo_anulacion }}</small></div>
@endif

<table style="margin-top: 3mm;">
  <tr>
    <td style="padding-right: 8mm;">
      <table class="datos">
        <tr><td class="rotulo">Recepción</td><td class="valor normal num">{{ $lote->fecha_recepcion->format('d/m/Y H:i') }}</td></tr>
        @if ($lote->origen === 'COMPRA')
          <tr><td class="rotulo">Productor</td><td class="valor">{{ $lote->productor?->nombre }}</td></tr>
          <tr><td class="rotulo">Cooperativa</td><td class="valor normal">{{ $lote->cooperativa?->nombre ?? '—' }}</td></tr>
          <tr><td class="rotulo">Mina</td><td class="valor normal">{{ $lote->mina?->nombre ?? '—' }}</td></tr>
        @else
          <tr><td class="rotulo">Origen</td><td class="valor">Producción propia</td></tr>
          <tr><td class="rotulo">Mina · bocamina</td><td class="valor normal">{{ $lote->mina?->nombre }} · {{ $lote->bocamina?->codigo }}</td></tr>
        @endif
        <tr><td class="rotulo">Material</td><td class="valor num">{{ $lote->material ?? '—' }}</td></tr>
        <tr><td class="rotulo">Sacos</td><td class="valor num">{{ $resumen['num_sacos'] ?? '—' }}</td></tr>
        <tr><td class="rotulo">Peso neto húmedo</td><td class="valor num">{{ $kg($resumen['peso_neto_humedo_kg'] ?? 0) }} kg
          <span style="font-size: 9pt; font-weight: normal;">· {{ $resumen['num_pesajes'] ?? 0 }} pesaje(s)</span></td></tr>
      </table>
    </td>
    <td class="qr" style="width: 78mm;">
      <img src="{{ $qr }}" alt="">
      <div class="leyenda">Escanee para verificar</div>
      <div class="url">{{ $url }}</div>
    </td>
  </tr>
</table>

<div class="barras"><img src="{{ $barras }}" alt=""></div>
<div class="pie">Si los datos de la verificación no coinciden con este rótulo o con la carga, avise a recepción.
  Impreso el {{ now()->format('d/m/Y H:i') }}.</div>
</body>
</html>
