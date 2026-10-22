{{-- Nombre de la empresa con su logo y su línea de detalle (Administración → Datos de la empresa). --}}
<div class="institucion">@if (! empty($empresa['logo']))<img src="{{ $empresa['logo'] }}" alt="" style="height: {{ $alturaLogo ?? '9mm' }}; vertical-align: middle; margin-right: 2mm;">@endif{{ $institucion }}</div>
@if (! empty($empresa['subtitulo']))
<div style="font-size: 6.8pt; color: #444; margin-top: .4mm; {{ ($centrado ?? false) ? 'text-align: center;' : '' }}">{{ $empresa['subtitulo'] }}</div>
@endif
