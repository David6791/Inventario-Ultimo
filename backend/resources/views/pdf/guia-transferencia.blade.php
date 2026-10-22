{{--
  Guía de traslado. Acompaña físicamente al material durante el viaje: el
  transportista la lleva y el almacén de destino firma al recibir.
--}}
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>{{ $transferencia->numero }}</title>
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

    /* El recorrido, que es lo que define este documento. */
    table.recorrido { width: 100%; border-collapse: collapse; margin-bottom: 4mm;
                      clear: both; border: .6pt solid #000; }
    table.recorrido td { padding: 2.5mm 3mm; vertical-align: top; width: 45%; }
    table.recorrido td.flecha { width: 10%; text-align: center; font-size: 14pt;
                                border-left: .4pt solid #999;
                                border-right: .4pt solid #999; }
    table.recorrido .rotulo { font-size: 7pt; text-transform: uppercase;
                              letter-spacing: .04em; color: #333; display: block;
                              margin-bottom: 1mm; }
    table.recorrido .almacen { font-size: 10pt; font-weight: bold; }

    table.datos { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
    table.datos td { padding: 1.2mm 0; vertical-align: top; }
    table.datos .rotulo { width: 32mm; font-size: 7.5pt; text-transform: uppercase;
                          letter-spacing: .03em; color: #333; }
    table.datos .valor { border-bottom: .4pt dotted #666; }

    table.detalle { width: 100%; border-collapse: collapse; margin-bottom: 5mm; }
    table.detalle th { border: .6pt solid #000; background: #eee; padding: 1.5mm;
                       font-size: 7.5pt; text-transform: uppercase; }
    table.detalle td { border: .6pt solid #000; padding: 1.5mm; font-size: 8.5pt; }
    table.detalle .num { text-align: center; width: 8mm; }
    table.detalle .cant { text-align: right; width: 20mm; }
    table.detalle .und { text-align: center; width: 13mm; }
    table.detalle .cod { width: 22mm; font-family: "DejaVu Sans Mono", monospace;
                         font-size: 7.5pt; }
    table.detalle td.vacia { height: 6mm; }

    .motivo { margin-bottom: 5mm; }
    .motivo .rotulo { font-size: 7.5pt; text-transform: uppercase; color: #333;
                      letter-spacing: .03em; display: block; margin-bottom: 1mm; }
    .motivo .texto { border: .4pt solid #999; padding: 2mm; min-height: 10mm; }

    .conforme { font-size: 8pt; margin-bottom: 10mm; padding: 2mm;
                border: .4pt solid #999; }

    table.firmas { width: 100%; margin-top: 10mm; border-collapse: collapse; }
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
  <div class="titulo">Guía de Traslado entre Almacenes</div>

  <table class="cabecera-numero">
    <tr>
      <td>
        @if ($transferencia->estado->value === 'borrador')
      <span class="sello">Borrador — sin valor hasta el despacho</span>
    @elseif ($transferencia->estado->value === 'despachada')
      <span class="sello">En tránsito</span>
    @elseif ($transferencia->estado->value === 'anulada')
      <span class="sello anulada">Anulada</span>
    @endif
      </td>
      <td class="num">N.º {{ $transferencia->numero }}</td>
    </tr>
  </table>

  <table class="recorrido">
    <tr>
      <td>
        <span class="rotulo">Sale de</span>
        <span class="almacen">{{ $transferencia->origen?->nombre }}</span>
      </td>
      <td class="flecha">&rarr;</td>
      <td>
        <span class="rotulo">Llega a</span>
        <span class="almacen">{{ $transferencia->destino?->nombre }}</span>
      </td>
    </tr>
  </table>

  <table class="datos">
    <tr>
      <td class="rotulo">Fecha</td>
      <td class="valor" style="width:38%">{{ $transferencia->fecha?->format('d/m/Y') }}</td>
      <td class="rotulo">Transportista</td>
      <td class="valor">{{ $transferencia->transportista ?: '—' }}</td>
    </tr>
  </table>

  <table class="detalle">
    <thead>
      <tr>
        <th class="num">N.º</th>
        <th class="cod">Código</th>
        <th>Descripción del material</th>
        <th class="und">Unidad</th>
        <th class="cant">Despachado</th>
        <th class="cant">Recibido</th>
      </tr>
    </thead>
    <tbody>
      @foreach ($transferencia->detalles as $i => $linea)
        <tr>
          <td class="num">{{ $i + 1 }}</td>
          <td class="cod">{{ $linea->producto?->codigo }}</td>
          <td>
            {{ $linea->producto?->nombre }}
            @if ($linea->observacion)
              <br><span style="font-size:7.5pt; color:#333;">{{ $linea->observacion }}</span>
            @endif
          </td>
          <td class="und">{{ $linea->producto?->unidadMedida?->codigo }}</td>
          <td class="cant">{{ rtrim(rtrim(number_format((float) $linea->cantidad, 4, ',', '.'), '0'), ',') }}</td>
          {{-- Se llena a mano al recibir: puede llegar menos de lo que salió. --}}
          <td class="cant">
            @if ($linea->cantidad_recibida !== null)
              {{ rtrim(rtrim(number_format((float) $linea->cantidad_recibida, 4, ',', '.'), '0'), ',') }}
            @endif
          </td>
        </tr>
      @endforeach

      @for ($i = 0; $i < 2; $i++)
        <tr>
          <td class="num vacia">{{ count($transferencia->detalles) + $i + 1 }}</td>
          <td class="vacia"></td><td class="vacia"></td>
          <td class="vacia"></td><td class="vacia"></td><td class="vacia"></td>
        </tr>
      @endfor
    </tbody>
  </table>

  @if ($transferencia->motivo)
    <div class="motivo">
      <span class="rotulo">Motivo del traslado</span>
      <div class="texto">{{ $transferencia->motivo }}</div>
    </div>
  @endif

  <div class="conforme">
    El almacén de destino recibe conforme el material detallado. Cualquier
    diferencia entre lo despachado y lo recibido debe anotarse en la columna
    correspondiente y detallarse en la observación de recepción.
  </div>

  <table class="firmas">
    <tr>
      <td>
        <div class="linea-firma">
          {{ $transferencia->despachadaPor?->name }}
          <div class="cargo">Despachó — {{ $transferencia->origen?->nombre }}</div>
        </div>
      </td>
      <td>
        <div class="linea-firma">
          {{ $transferencia->transportista }}
          <div class="cargo">Transportó</div>
        </div>
      </td>
      <td>
        <div class="linea-firma">
          {{ $transferencia->recibidaPor?->name }}
          <div class="cargo">Recibió — {{ $transferencia->destino?->nombre }}</div>
        </div>
      </td>
    </tr>
  </table>

  <div class="pie">
    <table>
      <tr>
        <td class="izq">Registrado por {{ $transferencia->registradoPor?->name }}</td>
        <td class="der">Emitido el {{ now()->format('d/m/Y H:i') }}</td>
      </tr>
    </table>
  </div>

</body>
</html>
