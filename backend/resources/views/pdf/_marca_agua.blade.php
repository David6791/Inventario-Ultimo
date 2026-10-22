{{-- Marca de agua centrada en cada página (Administración → Datos de la empresa). --}}
@if (! empty($empresa['marca_agua']))
<div style="position: fixed; top: 28%; left: 0; right: 0; text-align: center; opacity: {{ $empresa['opacidad'] ?? 0.08 }};">
  <img src="{{ $empresa['marca_agua'] }}" alt="" style="width: 60%;">
</div>
@endif
