{{--
  Kardex impreso, en orden cronológico: es un libro, se lee de arriba hacia
  abajo. En pantalla va al revés porque ahí interesa lo último que pasó.
--}}
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Kardex {{ $producto->codigo }}</title>
  <style>
    @page { margin: 1.2cm 1.2cm 1.8cm 1.2cm; }
    body { font-family: "DejaVu Sans", sans-serif; font-size: 8pt; color: #000;
           line-height: 1.3; }

    .institucion { text-align: center; text-transform: uppercase; font-size: 9pt;
                   font-weight: bold; letter-spacing: .04em; margin-bottom: 1.5mm; }
    .titulo { text-align: center; font-size: 11pt; font-weight: bold;
              letter-spacing: .06em; padding-bottom: 1.5mm;
              border-bottom: 1.5pt solid #000; margin-bottom: 3mm; }

    table.datos { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
    table.datos td { padding: 1mm 0; }
    table.datos .rotulo { width: 24mm; font-size: 7pt; text-transform: uppercase;
                          letter-spacing: .03em; color: #333; }
    table.datos .valor { border-bottom: .4pt dotted #666; font-weight: bold; }

    table.mov { width: 100%; border-collapse: collapse; }
    table.mov th { border: .5pt solid #000; background: #eee; padding: 1.2mm;
                   font-size: 6.5pt; text-transform: uppercase; }
    table.mov td { border: .5pt solid #000; padding: 1.2mm; font-size: 7.5pt; }
    table.mov .cant { text-align: right; width: 16mm;
                      font-variant-numeric: tabular-nums; }
    table.mov .saldo { text-align: right; width: 18mm; font-weight: bold;
                       background: #f6f6f6; font-variant-numeric: tabular-nums; }
    table.mov .fecha { width: 20mm; }
    table.mov .doc { width: 34mm; font-family: "DejaVu Sans Mono", monospace;
                     font-size: 6.5pt; }
    /* Las anulaciones se distinguen: no son movimientos normales. */
    table.mov tr.anulacion td { color: #666; font-style: italic; }

    /*
      Pie de página.

      Sin `float`: DomPDF los maneja mal dentro de un bloque `position: fixed`
      y termina reflotando el pie en cada salto de página — aparecía repetido
      intercalado en el contenido. Una tabla de dos celdas hace lo mismo y es
      estable.

      `height` explícita: sin ella DomPDF no sabe cuánto ocupa el bloque y
      puede calcular mal dónde termina la página.
    */
    .pie { position: fixed; bottom: 0.7cm; left: 0; right: 0; height: 0.9cm;
           font-size: 6pt; color: #555;
           border-top: .3pt solid #999; padding-top: 1mm; }
    .pie table { width: 100%; border-collapse: collapse; }
    .pie td { padding: 0; border: 0; vertical-align: top; }
    .pie td.der { text-align: right; }

    .vacio { text-align: center; padding: 8mm; color: #666; font-size: 8pt; }
  </style>
</head>
<body>
@include('pdf._marca_agua')

  @include('pdf._institucion', ['centrado' => true])
  <div class="titulo">Kardex de Existencias</div>

  <table class="datos">
    <tr>
      <td class="rotulo">Producto</td>
      <td class="valor" style="width:40%">
        {{ $producto->codigo }} — {{ $producto->nombre }}
      </td>
      <td class="rotulo">Almacén</td>
      <td class="valor">{{ $almacen->nombre }}</td>
    </tr>
    <tr>
      <td class="rotulo">Unidad</td>
      <td class="valor">{{ $producto->unidadMedida?->codigo }}</td>
      <td class="rotulo">Período</td>
      <td class="valor">
        @if ($desde || $hasta)
          {{ $desde ? \Carbon\Carbon::parse($desde)->format('d/m/Y') : 'inicio' }}
          al
          {{ $hasta ? \Carbon\Carbon::parse($hasta)->format('d/m/Y') : 'hoy' }}
        @else
          Todos los movimientos
        @endif
      </td>
    </tr>
  </table>

  @if ($movimientos->isEmpty())
    <div class="vacio">
      Este producto no registra movimientos en el período consultado.
    </div>
  @else
    <table class="mov">
      <thead>
        <tr>
          <th class="fecha">Fecha</th>
          <th class="doc">Documento</th>
          <th>Detalle</th>
          <th class="cant">Entrada</th>
          <th class="cant">Salida</th>
          <th class="saldo">Saldo</th>
          @if ($veCostos)
            <th class="cant">C. unit.</th>
            <th class="cant">C. total</th>
          @endif
        </tr>
      </thead>
      <tbody>
        @foreach ($movimientos as $m)
          <tr class="{{ str_contains($m->documento_tipo, 'anulacion') ? 'anulacion' : '' }}">
            <td class="fecha">{{ $m->fecha?->format('d/m/Y H:i') }}</td>
            <td class="doc">{{ $m->documento_numero }}</td>
            <td>
              {{ str_replace('-', ' ', ucfirst($m->documento_tipo)) }}
              @if ($m->observacion)
                — {{ \Illuminate\Support\Str::limit($m->observacion, 60) }}
              @endif
            </td>
            <td class="cant">
              {{ $m->entrada > 0 ? rtrim(rtrim(number_format((float) $m->entrada, 4, ',', '.'), '0'), ',') : '' }}
            </td>
            <td class="cant">
              {{ $m->salida > 0 ? rtrim(rtrim(number_format((float) $m->salida, 4, ',', '.'), '0'), ',') : '' }}
            </td>
            <td class="saldo">{{ rtrim(rtrim(number_format((float) $m->saldo, 4, ',', '.'), '0'), ',') }}</td>
            @if ($veCostos)
              <td class="cant">{{ number_format((float) $m->costo_unitario, 2, ',', '.') }}</td>
              <td class="cant">{{ number_format((float) $m->costo_total, 2, ',', '.') }}</td>
            @endif
          </tr>
        @endforeach
      </tbody>
    </table>
  @endif

  <div class="pie">
    <table>
      <tr>
        <td class="izq">{{ $movimientos->count() }} movimiento(s)</td>
        <td class="der">Emitido el {{ now()->format('d/m/Y H:i') }}</td>
      </tr>
    </table>
  </div>

</body>
</html>
