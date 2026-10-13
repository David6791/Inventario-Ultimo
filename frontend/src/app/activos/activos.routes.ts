import { Routes } from '@angular/router';
import { conPermiso } from '../core/guards/permisos.guard';

export const ACTIVOS_ROUTES: Routes = [
  /* ------------------------------------------------- Sprint 2: valuación -- */
    {
    path: 'organizacion',
    children: [
      {
        path: 'personal',
        title: 'Personal',
        canMatch: [conPermiso('activos.ver')],
        loadComponent: () =>
          import('./organizacion/empleados.component').then((m) => m.EmpleadosComponent),
      },
      {
        path: 'importar',
        title: 'Importar personal',
        canMatch: [conPermiso('activos-config.administrar')],
        loadComponent: () =>
          import('./organizacion/importar-personal.component').then((m) => m.ImportarPersonalComponent),
      },
      {
        path: 'centros',
        title: 'Centros de costo',
        canMatch: [conPermiso('activos.ver')],
        loadComponent: () =>
          import('./organizacion/centros-costo.component').then((m) => m.CentrosCostoComponent),
      },
      { path: '', redirectTo: 'personal', pathMatch: 'full' },
    ],
  },
  {
    path: 'valuacion',
    children: [
      {
        path: '',
        title: 'Cierre mensual',
        canMatch: [conPermiso('activos-valuacion.ver')],
        loadComponent: () =>
          import('./valuacion/cierres-lista.component').then((m) => m.CierresListaComponent),
      },
      {
        path: ':id',
        title: 'Período de valuación',
        canMatch: [conPermiso('activos-valuacion.ver')],
        loadComponent: () =>
          import('./valuacion/cierre-detalle.component').then((m) => m.CierreDetalleComponent),
      },
    ],
  },

  /* ------------------------------------------------- Sprint 2: registro -- */
  {
    path: 'registro',
    children: [
      {
        path: 'organizacion',
        children: [
          {
            path: 'personal',
            title: 'Personal',
            canMatch: [conPermiso('activos.ver')],
            loadComponent: () =>
              import('./organizacion/empleados.component').then((m) => m.EmpleadosComponent),
          },
          // 'importar' ANTES de cualquier ruta con parámetro
          {
            path: 'importar',
            title: 'Importar personal',
            canMatch: [conPermiso('activos-config.administrar')],
            loadComponent: () =>
              import('./organizacion/importar-personal.component').then((m) => m.ImportarPersonalComponent),
          },
          {
            path: 'centros',
            title: 'Centros de costo',
            canMatch: [conPermiso('activos.ver')],
            loadComponent: () =>
              import('./organizacion/centros-costo.component').then((m) => m.CentrosCostoComponent),
          },
          { path: '', redirectTo: 'personal', pathMatch: 'full' },
        ],
      },
      {
        path: '',
        title: 'Activos fijos',
        canMatch: [conPermiso('activos.ver')],
        loadComponent: () =>
          import('./registro/activo-lista.component').then((m) => m.ActivoListaComponent),
      },
      // `nuevo` y `etiquetas` ANTES que `:id`
      {
        path: 'nuevo',
        title: 'Nuevo activo',
        canMatch: [conPermiso('activos.crear')],
        loadComponent: () =>
          import('./registro/activo-form.component').then((m) => m.ActivoFormComponent),
      },
      {
        path: 'importar',
        title: 'Importar activos',
        canMatch: [conPermiso('activos.crear')],
        loadComponent: () =>
          import('./registro/importar.component').then((m) => m.ImportarComponent),
      },
      {
        path: 'etiquetas',
        title: 'Etiquetas',
        canMatch: [conPermiso('activos.codificar')],
        loadComponent: () =>
          import('./registro/etiquetas.component').then((m) => m.EtiquetasComponent),
      },
      {
        path: ':id',
        title: 'Ficha del activo',
        canMatch: [conPermiso('activos.ver')],
        loadComponent: () =>
          import('./registro/activo-ficha.component').then((m) => m.ActivoFichaComponent),
      },
    ],
  },

  /* ------------------------------------------------- Custodia -- */
  {
    path: 'custodia',
    children: [
      {
        path: '',
        title: 'Custodia de bienes',
        canMatch: [conPermiso('activos.ver')],
        loadComponent: () =>
          import('./custodia/documento-lista.component').then((m) => m.DocumentoListaComponent),
      },
      {
        path: 'nuevo',
        title: 'Nuevo documento',
        canMatch: [conPermiso('activos-custodia.asignar')],
        loadComponent: () =>
          import('./custodia/documento-form.component').then((m) => m.DocumentoFormComponent),
      },
      {
        path: 'por-custodio',
        title: 'Bienes por custodio',
        canMatch: [conPermiso('activos.ver')],
        loadComponent: () =>
          import('./custodia/por-custodio.component').then((m) => m.PorCustodioComponent),
      },
      {
        path: ':id',
        title: 'Documento de custodia',
        canMatch: [conPermiso('activos.ver')],
        loadComponent: () =>
          import('./custodia/documento-ficha.component').then((m) => m.DocumentoFichaComponent),
      },
    ],
  },

  /* --------------------------------------------- Sprint 1: configuración -- */
  {
    path: 'configuracion',
    children: [
      {
        path: 'clases',
        title: 'Clases de activo',
        canMatch: [conPermiso('activos-config.ver')],
        loadComponent: () =>
          import('./configuracion/clases/clases.component').then((m) => m.ClasesComponent),
      },
      {
        path: 'subclases',
        title: 'Subclases',
        canMatch: [conPermiso('activos-config.ver')],
        loadComponent: () =>
          import('./configuracion/subclases/subclases.component').then((m) => m.SubclasesComponent),
      },
      {
        path: 'ubicaciones',
        title: 'Ubicaciones',
        canMatch: [conPermiso('activos-config.ver')],
        loadComponent: () =>
          import('./configuracion/ubicaciones/ubicaciones.component').then(
            (m) => m.UbicacionesComponent
          ),
      },
      {
        path: 'parametros',
        title: 'Parámetros del módulo',
        canMatch: [conPermiso('activos-config.ver')],
        loadComponent: () =>
          import('./configuracion/parametros/parametros.component').then(
            (m) => m.ParametrosComponent
          ),
      },
      { path: '', redirectTo: 'clases', pathMatch: 'full' },
    ],
  },

  { path: '', redirectTo: 'registro', pathMatch: 'full' },
];