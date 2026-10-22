{{--
  Base del formulario impreso.

  Está pensado para el papel, no para la pantalla: sin color de fondo (gasta
  tóner y se lee peor en fotocopia), tipografía serif para el cuerpo porque el
  documento se archiva y se relee, y bloques de firma con espacio real para
  firmar y sellar.

  DejaVu es la única familia que dompdf trae con acentos completos.
--}}
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>{{ $solicitud->numero }}</title>
  <style>
    @page { margin: 1.6cm 1.5cm 2.2cm 1.5cm; }

    body {
      font-family: "DejaVu Sans", sans-serif;
      font-size: 9pt;
      color: #000;
      line-height: 1.35;
    }

    /* --- Encabezado --- */
    .institucion {
      text-align: center;
      text-transform: uppercase;
      font-size: 10pt;
      font-weight: bold;
      letter-spacing: .04em;
      margin-bottom: 2mm;
    }
    .titulo {
      text-align: center;
      font-size: 12pt;
      font-weight: bold;
      letter-spacing: .06em;
      padding-bottom: 2mm;
      border-bottom: 1.5pt solid #000;
      margin-bottom: 1mm;
    }
    .numero {
      text-align: right;
      font-size: 11pt;
      font-weight: bold;
      margin: 2mm 0 4mm;
    }

    /* --- Cabecera de datos --- */
    table.datos { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
    table.datos td { padding: 1.2mm 0; vertical-align: top; }
    table.datos .rotulo {
      width: 32mm;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: .03em;
      color: #333;
    }
    table.datos .valor { border-bottom: .4pt dotted #666; }

    /* --- Detalle --- */
    table.detalle { width: 100%; border-collapse: collapse; margin-bottom: 5mm; }
    table.detalle th {
      border: .6pt solid #000;
      background: #eee;
      padding: 1.5mm 1.5mm;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: .02em;
    }
    table.detalle td {
      border: .6pt solid #000;
      padding: 1.5mm;
      font-size: 8.5pt;
    }
    table.detalle .num { text-align: center; width: 8mm; }
    table.detalle .cant { text-align: right; width: 20mm; }
    table.detalle .und { text-align: center; width: 14mm; }
    table.detalle .cod { width: 24mm; font-family: "DejaVu Sans Mono", monospace;
                         font-size: 7.5pt; }

    /* Filas en blanco al final: en papel siempre se agrega algo a mano. */
    table.detalle td.vacia { height: 6mm; }

    .justificacion { margin-bottom: 6mm; }
    .justificacion .rotulo {
      font-size: 7.5pt; text-transform: uppercase; color: #333;
      letter-spacing: .03em; display: block; margin-bottom: 1mm;
    }
    .justificacion .texto {
      border: .4pt solid #999; padding: 2mm; min-height: 12mm;
    }

    /* --- Firmas --- */
    table.firmas { width: 100%; margin-top: 14mm; border-collapse: collapse; }
    table.firmas td {
      width: 33.33%;
      text-align: center;
      vertical-align: bottom;
      padding: 0 4mm;
    }
    .linea-firma {
      border-top: .6pt solid #000;
      padding-top: 1.5mm;
      font-size: 8pt;
    }
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
  <div class="titulo">@yield('titulo')</div>
  <div class="numero">N.º {{ $solicitud->numero }}</div>

  @yield('contenido')

  <table class="firmas">
    <tr>
      <td>
        <div class="linea-firma">
          {{ $solicitud->solicitante }}
          <div class="cargo">Solicitante</div>
        </div>
      </td>
      <td>
        <div class="linea-firma">
          <div class="cargo">@yield('firma-central', 'Jefe de la unidad solicitante')</div>
        </div>
      </td>
      <td>
        <div class="linea-firma">
          <div class="cargo">Responsable de almacén</div>
        </div>
      </td>
    </tr>
  </table>

  <div class="pie">
    <table>
      <tr>
        <td class="izq">{{ $solicitud->almacen?->nombre }} ·
      Registrado por {{ $solicitud->registradoPor?->name }}</td>
        <td class="der">Emitido el {{ now()->format('d/m/Y H:i') }}</td>
      </tr>
    </table>
  </div>

</body>
</html>
