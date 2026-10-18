{{--
  Boleta de recepción de mineral, media carta apaisada. Página 1: original
  para la empresa; página 2: copia para el productor. El código de barras
  (Code 128) es el código del lote: lo leen la báscula, el laboratorio y caja.
  Los pesos son húmedos: el peso seco y la ley salen del laboratorio.
--}}
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Boleta {{ $lote->codigo }}</title>
  <style>
    @page { margin: .8cm 1cm; }
    body { font-family: "DejaVu Sans", sans-serif; font-size: 7.6pt; color: #000; line-height: 1.25; }
    table { border-collapse: collapse; width: 100%; }
    td, th { vertical-align: top; padding: 0; }
    .pagina { page-break-after: always; position: relative; height: 11.9cm; }
    .pagina:last-child { page-break-after: auto; }
    .institucion { font-size: 8.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: .04em; }
    .sede { font-size: 6.6pt; color: #333; }
    .titulo { font-size: 10.5pt; font-weight: bold; letter-spacing: .05em; }
    .tanto { font-size: 6.3pt; text-transform: uppercase; letter-spacing: .08em; color: #333; }
    .codigo { font-family: "DejaVu Sans Mono", monospace; font-size: 13pt; font-weight: bold; text-align: center; }
    .regla { border-top: 1.1pt solid #000; margin: 1.5mm 0 2mm; }
    .sello { border: 1.2pt solid #000; padding: .6mm 2mm; font-weight: bold; font-size: 8pt; letter-spacing: .08em; }
    table.datos td { padding: .55mm 0; }
    table.datos .rotulo { width: 20mm; font-size: 6.2pt; text-transform: uppercase; color: #333; padding-top: .9mm; }
    table.datos .valor { border-bottom: .3pt dotted #777; padding-right: 3mm; }
    table.grilla th { border: .5pt solid #000; background: #eee; padding: .7mm 1mm; font-size: 6pt; text-transform: uppercase; text-align: left; }
    table.grilla td { border: .4pt solid #888; padding: .6mm 1mm; }
    .num { text-align: right; font-family: "DejaVu Sans Mono", monospace; white-space: nowrap; }
    th.num { text-align: right; font-family: "DejaVu Sans", sans-serif; }
    .anulado td { color: #777; text-decoration: line-through; }
    .total td { font-weight: bold; border-top: 1pt solid #000; }
    .nota { font-size: 6.3pt; color: #333; margin-top: 1.2mm; }
    table.firmas { position: absolute; bottom: 4mm; left: 0; right: 0; }
    table.firmas td { width: 33.33%; text-align: center; padding: 0 5mm; vertical-align: bottom; }
    .linea-firma { border-top: .6pt solid #000; padding-top: 1mm; font-size: 6.8pt; }
    .cargo { font-size: 6pt; color: #333; }
  </style>
</head>
<body>
@php
  $kg = fn ($v) => number_format((float) $v, 2, ',', '.');
  $ingresos = $lote->pesajes->where('tipo', 'INGRESO');
  $vigentes = $ingresos->where('anulado', false);
  $chofer = $vigentes->first()?->chofer_nombre;
  $conCliente = $ingresos->whereNotNull('peso_cliente_kg')->isNotEmpty();
@endphp

@foreach (['Original — empresa', 'Copia — productor'] as $tanto)
<div class="pagina">
  <table>
    <tr>
      <td>
        <div class="institucion">{{ $institucion }}</div>
        <div class="sede">{{ $lote->almacen?->nombre }} · Recibido por {{ $lote->registradoPor?->name }}</div>
        <div class="titulo" style="margin-top: 1.5mm;">BOLETA DE RECEPCIÓN DE MINERAL</div>
        <div class="tanto">{{ $tanto }}</div>
      </td>
      <td style="width: 82mm; text-align: center;">
        <img src="{{ $barras }}" style="height: 12mm; max-width: 80mm;" alt="">
        <div class="codigo">{{ $lote->codigo }}</div>
        @if ($lote->estado === 'ANULADO')<span class="sello">ANULADO</span>@endif
      </td>
    </tr>
  </table>
  <div class="regla"></div>

  <table>
    <tr>
      <td style="width: 50%;">
        <table class="datos">
          <tr><td class="rotulo">Fecha</td><td class="valor">{{ $lote->fecha_recepcion?->format('d/m/Y H:i') }}</td></tr>
          <tr><td class="rotulo">Mineral</td><td class="valor">{{ $lote->linea?->nombre }} · serie {{ $lote->serie?->prefijo }}</td></tr>
          @if ($lote->origen === 'COMPRA')
            <tr><td class="rotulo">Productor</td><td class="valor">{{ $lote->productor?->nombre }}
              @if ($lote->productor?->ci) · CI {{ $lote->productor->ci }}@elseif ($lote->productor?->nit) · NIT {{ $lote->productor->nit }}@endif</td></tr>
            <tr><td class="rotulo">Cooperativa</td><td class="valor">{{ $lote->cooperativa?->nombre ?? '—' }}</td></tr>
          @else
            <tr><td class="rotulo">Origen</td><td class="valor">Producción propia</td></tr>
          @endif
        </table>
      </td>
      <td style="width: 50%; padding-left: 4mm;">
        <table class="datos">
          <tr><td class="rotulo">Mina</td><td class="valor">{{ $lote->mina?->nombre ?? '—' }}@if ($lote->bocamina) · bocamina {{ $lote->bocamina->codigo }}@endif</td></tr>
          <tr><td class="rotulo">Municipio</td><td class="valor">{{ $lote->municipio?->nombre ?? '—' }}</td></tr>
          @if ($lote->material)
            <tr><td class="rotulo">Material</td><td class="valor">{{ $lote->material }}</td></tr>
          @endif
          <tr><td class="rotulo">Guía</td><td class="valor">{{ $lote->guia_transporte ?? '—' }}</td></tr>
          <tr><td class="rotulo">Observ.</td><td class="valor">{{ $lote->observaciones ?: '—' }}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <table class="grilla" style="margin-top: 2.5mm;">
    <thead>
      <tr>
        <th>Ticket</th><th>Báscula</th><th>Placa</th><th>Chofer</th>
        <th class="num">Sacos</th><th class="num">Bruto kg</th><th class="num">Tara kg</th><th class="num">Neto kg</th>@if ($conCliente)<th class="num">Cliente kg</th>@endif<th class="num">Bono</th>
      </tr>
    </thead>
    <tbody>
      @forelse ($ingresos as $p)
        <tr class="{{ $p->anulado ? 'anulado' : '' }}">
          <td class="num" style="text-align: left">{{ $p->ticket }}</td>
          <td>{{ $p->bascula }}</td>
          <td>{{ $p->placa ?? '—' }}</td>
          <td>{{ $p->chofer_nombre }}</td>
          <td class="num">{{ $p->num_sacos ?? '' }}</td>
          <td class="num">{{ $kg($p->peso_bruto_kg) }}</td>
          <td class="num">{{ $kg($p->tara_kg) }}</td>
          <td class="num">{{ $kg($p->peso_neto_kg) }}</td>
          @if ($conCliente)<td class="num">{{ $p->peso_cliente_kg !== null ? $kg($p->peso_cliente_kg) : '—' }}</td>@endif
          <td class="num">{{ $p->bono && $p->bono->estado !== 'ANULADO' ? ($p->bono->moneda === 'USD' ? 'US$' : 'Bs') . ' ' . $kg($p->bono->monto) . ($p->bono->estado === 'PAGADO' ? ' ✓' : '') : '—' }}</td>
        </tr>
      @empty
        <tr><td colspan="{{ $conCliente ? 10 : 9 }}">Sin pesajes registrados todavía.</td></tr>
      @endforelse
      <tr class="total">
        <td colspan="4">Total ({{ $vigentes->count() }} pesaje{{ $vigentes->count() === 1 ? '' : 's' }})</td>
        <td class="num">{{ $resumen['num_sacos'] ?? '' }}</td>
        <td></td><td></td>
        <td class="num">{{ $kg($resumen['peso_neto_humedo_kg'] ?? 0) }}</td>
        @if ($conCliente)<td class="num">{{ $kg($resumen['peso_cliente_kg'] ?? 0) }}</td>@endif
        <td></td>
      </tr>
    </tbody>
  </table>
  <div class="nota">
    Pesos húmedos. El peso seco y las leyes se determinan en laboratorio con la muestra del lote; el productor
    recibe su porción de muestra precintada. ✓ = bono pagado.
    @if ($conCliente)
      Vale el peso de la báscula de la empresa; el del cliente es el que él declaró
      (diferencia {{ (float) $resumen['diferencia_cliente_kg'] > 0 ? '+' : '' }}{{ $kg($resumen['diferencia_cliente_kg']) }} kg).
    @endif
  </div>

  <table class="firmas">
    <tr>
      <td><div class="linea-firma">{{ $lote->registradoPor?->name }}<div class="cargo">Recepción</div></div></td>
      <td><div class="linea-firma">{{ $lote->productor?->nombre ?? '' }}<div class="cargo">{{ $lote->origen === 'COMPRA' ? 'Productor — entregué conforme' : 'Responsable de bocamina' }}</div></div></td>
      <td><div class="linea-firma">{{ $chofer }}<div class="cargo">Chofer</div></div></td>
    </tr>
  </table>
</div>
@endforeach
</body>
</html>
