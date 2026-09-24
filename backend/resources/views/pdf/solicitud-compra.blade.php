@extends('pdf._base')

@section('titulo', 'Solicitud de Compra')
@section('firma-central', 'Responsable de Presupuestos')

@section('contenido')

  <table class="datos">
    <tr>
      <td class="rotulo">Fecha</td>
      <td class="valor" style="width:38%">{{ $solicitud->fecha?->format('d/m/Y') }}</td>
      <td class="rotulo">Partida presupuestaria</td>
      <td class="valor">{{ $solicitud->partida_presupuestaria ?: '—' }}</td>
    </tr>
    <tr>
      <td class="rotulo">Unidad solicitante</td>
      <td class="valor">{{ $solicitud->unidad_solicitante }}</td>
      <td class="rotulo">Monto estimado</td>
      <td class="valor">
        {{ $solicitud->monto_estimado !== null
            ? 'Bs '.number_format((float) $solicitud->monto_estimado, 2, ',', '.')
            : '—' }}
      </td>
    </tr>
    <tr>
      <td class="rotulo">Solicitante</td>
      <td class="valor">{{ $solicitud->solicitante }}</td>
      <td class="rotulo">Almacén destino</td>
      <td class="valor">{{ $solicitud->almacen?->nombre }}</td>
    </tr>
  </table>

  <table class="detalle">
    <thead>
      <tr>
        <th class="num">N.º</th>
        <th class="cod">Código</th>
        <th>Descripción del bien o servicio</th>
        <th class="und">Unidad</th>
        <th class="cant">Cantidad</th>
      </tr>
    </thead>
    <tbody>
      @foreach ($solicitud->detalles as $i => $linea)
        <tr>
          <td class="num">{{ $i + 1 }}</td>
          <td class="cod">{{ $linea->producto?->codigo }}</td>
          <td>
            {{ $linea->producto?->nombre }}
            @if ($linea->especificacion)
              <br><span style="font-size:7.5pt; color:#333;">{{ $linea->especificacion }}</span>
            @endif
          </td>
          <td class="und">{{ $linea->producto?->unidadMedida?->codigo }}</td>
          <td class="cant">{{ rtrim(rtrim(number_format((float) $linea->cantidad, 4, ',', '.'), '0'), ',') }}</td>
        </tr>
      @endforeach

      {{-- En papel siempre se agrega algo a mano antes de firmar. --}}
      @for ($i = 0; $i < 3; $i++)
        <tr>
          <td class="num vacia">{{ count($solicitud->detalles) + $i + 1 }}</td>
          <td class="vacia"></td><td class="vacia"></td>
          <td class="vacia"></td><td class="vacia"></td>
        </tr>
      @endfor
    </tbody>
  </table>

  <div class="justificacion">
    <span class="rotulo">Justificación de la compra</span>
    <div class="texto">{{ $solicitud->justificacion }}</div>
  </div>

@endsection
