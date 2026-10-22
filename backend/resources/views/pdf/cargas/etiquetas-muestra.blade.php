{{--
  Etiquetas de las porciones de una muestra: tres por hoja carta, para
  recortar y pegar en cada bolsa. El código de barras lleva el código de
  la muestra con la inicial de la porción (E, P o T); el QR abre la
  verificación pública del lote.
--}}
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Etiquetas {{ $muestra->codigo }}</title>
  <style>
    @page { margin: .8cm 1cm; }
    body { font-family: "DejaVu Sans", sans-serif; color: #000; font-size: 9pt; line-height: 1.25; }
    table { border-collapse: collapse; width: 100%; }
    td { vertical-align: top; padding: 0; }
    .etiqueta { height: 7.3cm; border: 1pt dashed #777; padding: 3mm 4mm; margin-bottom: 2.5mm; }
    .institucion { font-size: 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: .05em; }
    .destino { font-size: 13pt; font-weight: bold; letter-spacing: .1em; margin-top: 1mm; }
    .codigo { font-family: "DejaVu Sans Mono", monospace; font-size: 20pt; font-weight: bold; margin: 1.5mm 0; }
    .precinto { border: 1.5pt solid #000; display: inline-block; padding: 1mm 3mm; font-size: 12pt; font-weight: bold; }
    .precinto span { font-size: 7pt; font-weight: normal; letter-spacing: .05em; text-transform: uppercase; }
    table.datos td { padding: .6mm 0; font-size: 8.5pt; }
    table.datos .rotulo { width: 24mm; font-size: 6.8pt; text-transform: uppercase; color: #333; padding-top: 1mm; }
    .qr img { width: 30mm; height: 30mm; }
    .barras img { height: 11mm; max-width: 110mm; }
    .nota { font-size: 6.5pt; color: #333; }
  </style>
</head>
<body>
@foreach ($porciones as $item)
  @php $p = $item['porcion']; @endphp
  <div class="etiqueta">
    <table>
      <tr>
        <td>
          @include('pdf._institucion', ['alturaLogo' => '7mm'])
          <div class="destino">MUESTRA · PORCIÓN {{ $p->destino }}</div>
          <div class="codigo">{{ $muestra->codigo }}</div>
          <div class="precinto"><span>Precinto</span> {{ $p->precinto ?? '—' }}</div>
          <table class="datos" style="margin-top: 2mm;">
            <tr><td class="rotulo">Lote</td><td>{{ $lote->codigo }} · {{ $lote->linea?->nombre }}{{ $lote->material ? ' · ' . $lote->material : '' }}</td></tr>
            <tr><td class="rotulo">Productor</td><td>{{ $lote->productor?->nombre ?? 'Producción propia' }}</td></tr>
            <tr><td class="rotulo">Muestreo</td><td>{{ $muestra->fecha->format('d/m/Y H:i') }}{{ $muestra->metodo ? ' · ' . strtolower($muestra->metodo) : '' }}{{ $muestra->tipo === 'REMUESTREO' ? ' · REMUESTREO' : '' }}</td></tr>
            @if ($p->entregada_a)
              <tr><td class="rotulo">Entregada a</td><td>{{ $p->entregada_a }}</td></tr>
            @endif
          </table>
        </td>
        <td class="qr" style="width: 34mm; text-align: center;">
          <img src="{{ $qr }}" alt="">
          <div class="nota">Verificar lote</div>
        </td>
      </tr>
    </table>
    <div class="barras" style="margin-top: 1.5mm;"><img src="{{ $item['barras'] }}" alt=""></div>
    <div class="nota">
      @if ($p->destino === 'TESTIGO')
        Porción testigo: se guarda precintada para la dirimencia. No abrir sin acta.
      @elseif ($p->destino === 'PRODUCTOR')
        Porción del productor: para su laboratorio. Verifique el precinto al recibirla.
      @else
        Porción de la empresa: para el análisis del laboratorio de la empresa.
      @endif
    </div>
  </div>
@endforeach
</body>
</html>
