# Registro en FabricaReportes

Agregar tres entradas a `TIPOS`:

```php
    private const TIPOS = [
        'existencias'          => ReporteExistencias::class,
        'valorizado'           => ReporteValorizado::class,
        'movimientos'          => ReporteMovimientos::class,
        'vencimientos'         => ReporteVencimientos::class,
        'consumo-areas'        => ReporteConsumoAreas::class,
        'consumo-solicitantes' => ReporteConsumoSolicitantes::class,
        'consumo-productos'    => ReporteConsumoProductos::class,
    ];
```

Nada más. El controlador, el Blade y `ReporteExport` no se tocan.

Las URLs quedan:

    GET /api/reportes/consumo-areas?desde=2026-09-01&hasta=2026-09-30
    GET /api/reportes/consumo-areas/pdf?...
    GET /api/reportes/consumo-areas/excel?...

Y lo mismo para `consumo-solicitantes` y `consumo-productos`.

## Permiso

Las tres declaran `reportes.consumo`. Si más adelante quieres que el detalle
por producto sea más restringido que el agregado por área, cambia el
`permiso()` de `ReporteConsumoProductos` y listo.

## Correcciones al paquete anterior

**1. `cantidad_disponible` no existe: es `cantidad_restante`.**

En `DevolucionService`, tres lugares:

```php
// restituirCapas()
CapaExistencia::whereKey($consumo->capa_id)
    ->lockForUpdate()
    ->first()
    ?->increment('cantidad_restante', $aplicar);

// anular(), la validación y el decremento
if ((float) $capa->cantidad_restante < (float) $restitucion->cantidad) { ... }
$capa->decrement('cantidad_restante', (float) $restitucion->cantidad);
```

**2. `CorrelativoService` no existe.** La tabla es `contadores_documento`.
Reemplazar las llamadas por el servicio real que ya usan ingresos y salidas
para numerar sus documentos.

**3. Verificar las columnas de `consumos_capa`.** El código asume
`salida_detalle_id`, `capa_id`, `cantidad` y `costo_unitario`:

    docker compose exec db psql -U inventarios -d inventarios -c "\d consumos_capa"
