# Entrada de menú

Agregar al menú lateral existente, respetando el patrón de permisos del proyecto.
El `permiso` de cada ítem debe coincidir con los nombres del enum `App\Enums\Permisos`.

```ts
{
  label: 'Activos fijos',
  icon: 'pi pi-desktop',
  permiso: 'activos-config.ver',
  items: [
    {
      label: 'Configuración',
      icon: 'pi pi-cog',
      permiso: 'activos-config.ver',
      items: [
        { label: 'Clases',      icon: 'pi pi-sitemap',   routerLink: '/activos/configuracion/clases' },
        { label: 'Subclases',   icon: 'pi pi-list',      routerLink: '/activos/configuracion/subclases' },
        { label: 'Ubicaciones', icon: 'pi pi-map-marker',routerLink: '/activos/configuracion/ubicaciones' },
        { label: 'Parámetros',  icon: 'pi pi-sliders-h', routerLink: '/activos/configuracion/parametros' },
      ],
    },
    // Sprints siguientes:
    // { label: 'Registro de activos', routerLink: '/activos/registro',   permiso: 'activos.ver' },
    // { label: 'Cierre mensual',      routerLink: '/activos/cierre',     permiso: 'activos-valuacion.ver' },
    // { label: 'Inventario físico',   routerLink: '/activos/inventario', permiso: 'activos-inventario.ver' },
  ],
}
```

## environment

El servicio usa `environment.apiUrl`. Para que la demo funcione desde cualquier
equipo de la red sin recompilar, en `environment.prod.ts`:

```ts
export const environment = { production: true, apiUrl: '/api' };
```

nginx sirve Angular en `/` y hace proxy de `/api` al backend, así que el origen
es el mismo y no hace falta configurar CORS.
