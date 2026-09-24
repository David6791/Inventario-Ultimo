{{--
  Plantilla única para los cuatro reportes.

  Recibe las columnas y las filas ya resueltas por el objeto Reporte, el mismo
  que alimenta la pantalla y el Excel. Una sola plantilla en vez de cuatro:
  cualquier mejora de formato beneficia a todos y ninguno se queda atrás.
--}}
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>{{ $reporte->titulo() }}</title>
  <style>
    @page { margin: 1.4cm 1.2cm 1.8cm 1.2cm; }
    body { font-family: "DejaVu Sans", sans-serif; font-size: 8pt; color: #000;
           line-height: 1.3; }

    .institucion { text-align: center; text-transform: uppercase; font-size: 9pt;
                   font-weight: bold; letter-spacing: .04em; margin-bottom: 1.5mm; }
    .titulo { text-align: center; font-size: 12pt; font-weight: bold;
              letter-spacing: .05em; padding-bottom: 2mm;
              border-bottom: 1.5pt solid #000; margin-bottom: 3mm; }

    /* Los filtros van a la vista: un reporte sin sus criterios no sirve como
       respaldo porque nadie sabe qué se consultó. */
    .filtros { margin-bottom: 3mm; }
    .filtros span { display: inline-block; margin-right: 6mm; font-size: 7.5pt; }
    .filtros .rotulo { color: #555; text-transform: uppercase; font-size: 6.5pt;
                       letter-spacing: .03em; }
    .filtros .valor { font-weight: bold; }

    table.datos { width: 100%; border-collapse: collapse; }
    table.datos th { border: .5pt solid #000; background: #16323F; color: #fff;
                     padding: 1.4mm; font-size: 6.5pt; text-transform: uppercase;
                     letter-spacing: .02em; }
    table.datos td { border: .5pt solid #999; padding: 1.3mm; font-size: 7.5pt; }
    table.datos tr:nth-child(even) td { background: #f7f8f8; }

    td.cantidad, td.moneda, td.entero,
    th.cantidad, th.moneda, th.entero { text-align: right;
                                        font-variant-numeric: tabular-nums; }
    th.cantidad, th.moneda, th.entero { text-align: right; }
    td.fecha, th.fecha { text-align: center; }
    td.codigo { font-family: "DejaVu Sans Mono", monospace; font-size: 6.5pt; }

    tr.totales td { border: 0; border-top: 1.2pt solid #000; font-weight: bold;
                    padding-top: 2mm; background: #fff !important; font-size: 8pt; }

    /* Situaciones que piden atención en el reporte de vencimientos. */
    td.destacado-vencido { color: #B4541E; font-weight: bold; }
    td.destacado-critico { color: #A67C00; font-weight: bold; }

    .vacio { text-align: center; padding: 12mm 4mm; color: #555; font-size: 8.5pt;
             border: .5pt dashed #999; }

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
  </style>
</head>
<body>

  <div class="institucion">{{ $institucion }}</div>
  <div class="titulo">{{ $reporte->titulo() }}</div>

  @if (count($filtros))
    <div class="filtros">
      @foreach ($filtros as $rotulo => $valor)
        <span>
          <span class="rotulo">{{ $rotulo }}:</span>
          <span class="valor">{{ $valor }}</span>
        </span>
      @endforeach
    </div>
  @endif

  @if ($filas->isEmpty())
    <div class="vacio">{{ $reporte->mensajeVacio() }}</div>
  @else
    <table class="datos">
      <thead>
        <tr>
          @foreach ($columnas as $c)
            <th class="{{ $c['tipo'] ?? 'texto' }}"
                @if(isset($c['ancho'])) style="width: {{ $c['ancho'] }}" @endif>
              {{ $c['titulo'] }}
            </th>
          @endforeach
        </tr>
      </thead>
      <tbody>
        @foreach ($filas as $fila)
          <tr>
            @foreach ($columnas as $c)
              @php
                $valor = $fila[$c['clave']] ?? null;
                $tipo  = $c['tipo'] ?? 'texto';

                $clase = $tipo;
                if ($c['clave'] === 'codigo' || $c['clave'] === 'lote') $clase .= ' codigo';

                // El reporte de vencimientos marca lo urgente.
                if ($c['clave'] === 'situacion') {
                    if ($valor === 'VENCIDO') $clase .= ' destacado-vencido';
                    elseif ($valor === 'Crítico') $clase .= ' destacado-critico';
                }
              @endphp
              <td class="{{ $clase }}">
                @switch($tipo)
                  @case('moneda')
                    {{ $valor !== null ? number_format((float) $valor, 2, ',', '.') : '' }}
                    @break
                  @case('cantidad')
                    {{ $valor !== null ? rtrim(rtrim(number_format((float) $valor, 4, ',', '.'), '0'), ',') : '' }}
                    @break
                  @case('entero')
                    {{ $valor !== null ? number_format((float) $valor, 0, ',', '.') : '' }}
                    @break
                  @default
                    {{ $valor }}
                @endswitch
              </td>
            @endforeach
          </tr>
        @endforeach

        @if (count($totales))
          @php
            $primeraCifra = null;
            foreach ($columnas as $i => $c) {
                if (isset($totales[$c['clave']])) { $primeraCifra = $i; break; }
            }
          @endphp
          <tr class="totales">
            @foreach ($columnas as $i => $c)
              @if (isset($totales[$c['clave']]))
                <td class="{{ $c['tipo'] ?? 'texto' }}">
                  @if (($c['tipo'] ?? '') === 'moneda')
                    {{ number_format((float) $totales[$c['clave']], 2, ',', '.') }}
                  @else
                    {{ rtrim(rtrim(number_format((float) $totales[$c['clave']], 4, ',', '.'), '0'), ',') }}
                  @endif
                </td>
              @elseif ($primeraCifra !== null && $i === $primeraCifra - 1)
                <td style="text-align: right;">TOTAL</td>
              @else
                <td></td>
              @endif
            @endforeach
          </tr>
        @endif
      </tbody>
    </table>
  @endif

  <div class="pie">
    <table>
      <tr>
        <td class="izq">{{ $filas->count() }} registro(s)</td>
        <td class="der">Emitido el {{ now()->format('d/m/Y H:i') }}</td>
      </tr>
    </table>
  </div>

</body>
</html>