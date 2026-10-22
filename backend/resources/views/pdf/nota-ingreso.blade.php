{{-- Acta de recepción: se imprime, se firma y se archiva junto a la factura. --}}
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>{{ $ingreso->numero }}</title>
  <style>
    @page { margin: 1.6cm 1.5cm 2.2cm 1.5cm; }
    body { font-family: "DejaVu Sans", sans-serif; font-size: 9pt; color: #000;
           line-height: 1.35; }

    .institucion { text-align: center; text-transform: uppercase; font-size: 10pt;
                   font-weight: bold; letter-spacing: .04em; margin-bottom: 2mm; }
    .titulo { text-align: center; font-size: 12pt; font-weight: bold;
              letter-spacing: .06em; padding-bottom: 2mm;
              border-bottom: 1.5pt solid #000; margin-bottom: 1mm; }

    /* Tabla en vez de floats: DomPDF los resuelve de forma impredecible. */
    table.cabecera-numero { width: 100%; border-collapse: collapse;
                            margin: 2mm 0 4mm; }
    table.cabecera-numero td { padding: 0; border: 0; vertical-align: middle; }
    table.cabecera-numero td.num { text-align: right; font-size: 11pt;
                                   font-weight: bold; }
    .sello { display: inline-block; border: 1pt solid #000; padding: .8mm 2mm; font-size: 8pt;
             text-transform: uppercase; letter-spacing: .05em; }
    .sello.anulada { text-decoration: line-through; }

    table.datos { width: 100%; border-collapse: collapse; margin-bottom: 4mm;
                  clear: both; }
    table.datos td { padding: 1.2mm 0; vertical-align: top; }
    table.datos .rotulo { width: 32mm; font-size: 7.5pt; text-transform: uppercase;
                          letter-spacing: .03em; color: #333; }
    table.datos .valor { border-bottom: .4pt dotted #666; }

    table.detalle { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
    table.detalle th { border: .6pt solid #000; background: #eee; padding: 1.5mm;
                       font-size: 7.5pt; text-transform: uppercase; }
    table.detalle td { border: .6pt solid #000; padding: 1.5mm; font-size: 8.5pt; }
    table.detalle .num { text-align: center; width: 8mm; }
    table.detalle .cant { text-align: right; width: 18mm; }
    table.detalle .imp { text-align: right; width: 22mm; }
    table.detalle .und { text-align: center; width: 13mm; }
    table.detalle .cod { width: 22mm; font-family: "DejaVu Sans Mono", monospace;
                         font-size: 7.5pt; }
    table.detalle tr.total td { border: 0; border-top: 1pt solid #000;
                                font-weight: bold; padding-top: 2mm; }

    .conforme { font-size: 8pt; margin: 6mm 0 10mm; padding: 2mm;
                border: .4pt solid #999; }

    table.firmas { width: 100%; margin-top: 8mm; border-collapse: collapse; }
    table.firmas td { width: 33.33%; text-align: center; vertical-align: bottom;
                      padding: 0 4mm; }
    .linea-firma { border-top: .6pt solid #000; padding-top: 1.5mm; font-size: 8pt; }
    .cargo { font-size: 7pt; color: #333; }

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
           font-size: 6.5pt; color: #555;
           border-top: .3pt solid #999; padding-top: 1mm; }
    .pie table { width: 100%; border-collapse: collapse; }
    .pie td { padding: 0; border: 0; vertical-align: top; }
    .pie td.der { text-align: right; }
  </style>
</head>
<body>
@include('pdf._marca_agua')

  @include('pdf._institucion', ['centrado' => true])
  <div class="titulo">Acta de Recepción y Nota de Ingreso</div>

  <table class="cabecera-numero">
    <tr>
      <td>
        @if ($ingreso->estado->value === 'borrador')
      <span class="sello">Borrador — sin valor hasta su confirmación</span>
    @elseif ($ingreso->estado->value === 'anulada')
      <span class="sello anulada">Anulada</span>
    @endif
      </td>
      <td class="num">N.º {{ $ingreso->numero }}</td>
    </tr>
  </table>

  <table class="datos">
    <tr>
      <td class="rotulo">Fecha de recepción</td>
      <td class="valor" style="width:38%">{{ $ingreso->fecha?->format('d/m/Y') }}</td>
      <td class="rotulo">Almacén</td>
      <td class="valor">{{ $ingreso->almacen?->nombre }}</td>
    </tr>
    <tr>
      <td class="rotulo">Proveedor</td>
      <td class="valor">{{ $ingreso->proveedor }}</td>
      <td class="rotulo">Solicitud de compra</td>
      <td class="valor">{{ $ingreso->solicitud?->numero }}</td>
    </tr>
    <tr>
      <td class="rotulo">Documento</td>
      <td class="valor">
        {{ ucfirst(str_replace('-', ' ', $ingreso->tipo_documento)) }}
        {{ $ingreso->numero_documento ? 'N.º '.$ingreso->numero_documento : '' }}
      </td>
      <td class="rotulo">Fecha del documento</td>
      <td class="valor">{{ $ingreso->fecha_documento?->format('d/m/Y') ?: '—' }}</td>
    </tr>
  </table>

  <table class="detalle">
    <thead>
      <tr>
        <th class="num">N.º</th>
        <th class="cod">Código</th>
        <th>Descripción</th>
        <th class="und">Unidad</th>
        <th class="cant">Cantidad</th>
        <th class="imp">P. unitario</th>
        <th class="imp">Importe</th>
      </tr>
    </thead>
    <tbody>
      @foreach ($ingreso->detalles as $i => $linea)
        <tr>
          <td class="num">{{ $i + 1 }}</td>
          <td class="cod">{{ $linea->producto?->codigo }}</td>
          <td>
            {{ $linea->producto?->nombre }}
            @if ($linea->lote || $linea->fecha_vencimiento)
              <br><span style="font-size:7.5pt; color:#333;">
                @if ($linea->lote) Lote {{ $linea->lote }} @endif
                @if ($linea->fecha_vencimiento) · Vence {{ $linea->fecha_vencimiento->format('d/m/Y') }} @endif
              </span>
            @endif
          </td>
          <td class="und">{{ $linea->producto?->unidadMedida?->codigo }}</td>
          <td class="cant">{{ rtrim(rtrim(number_format((float) $linea->cantidad, 4, ',', '.'), '0'), ',') }}</td>
          <td class="imp">{{ number_format((float) $linea->costo_unitario, 2, ',', '.') }}</td>
          <td class="imp">{{ number_format($linea->importe(), 2, ',', '.') }}</td>
        </tr>
      @endforeach

      <tr class="total">
        <td colspan="6" style="text-align:right;">Total en bolivianos</td>
        <td class="imp">{{ number_format($ingreso->valorTotal(), 2, ',', '.') }}</td>
      </tr>
    </tbody>
  </table>

  <div class="conforme">
    Se recibe el material detallado, verificada su cantidad, calidad y estado
    conforme a lo solicitado y al documento de respaldo citado. El material queda
    bajo custodia del almacén desde la fecha de esta acta.
  </div>

  <table class="firmas">
    <tr>
      <td>
        <div class="linea-firma">
          <div class="cargo">Entregó — Proveedor</div>
        </div>
      </td>
      <td>
        <div class="linea-firma">
          {{ $ingreso->confirmadaPor?->name }}
          <div class="cargo">Recibió — Responsable de almacén</div>
        </div>
      </td>
      <td>
        <div class="linea-firma">
          <div class="cargo">Visto bueno — Unidad solicitante</div>
        </div>
      </td>
    </tr>
  </table>

  <div class="pie">
    <table>
      <tr>
        <td class="izq">Registrado por {{ $ingreso->registradoPor?->name }}</td>
        <td class="der">Emitido el {{ now()->format('d/m/Y H:i') }}</td>
      </tr>
    </table>
  </div>

</body>
</html>
