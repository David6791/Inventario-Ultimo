import { Routes } from '@angular/router';
import { conPermiso } from '../core/guards/permisos.guard';

/**
 * Módulo de manejo de cargas (/cargas). Leer exige cargas.ver; los botones de
 * escritura se ocultan con *appTienePermiso y el backend vuelve a verificar.
 *
 * Recordatorio: rutas literales ANTES de las que llevan parámetro
 * (productores/importar antes que cualquier productores/:id).
 */
export const CARGAS_ROUTES: Routes = [
  {
    path: 'lotes/recibir',
    title: 'Recibir lote',
    canMatch: [conPermiso('cargas.recibir')],
    loadComponent: () => import('./recepcion/recibir-lote.component').then((m) => m.RecibirLoteComponent),
  },
  {
    path: 'lotes/:id',
    title: 'Lote',
    canMatch: [conPermiso('cargas.ver')],
    loadComponent: () => import('./recepcion/lote-ficha.component').then((m) => m.LoteFichaComponent),
  },
  {
    path: 'lotes',
    title: 'Lotes',
    canMatch: [conPermiso('cargas.ver')],
    loadComponent: () => import('./recepcion/lotes.component').then((m) => m.LotesComponent),
  },
  {
    path: 'laboratorio',
    title: 'Laboratorio',
    canMatch: [conPermiso('cargas.ver')],
    loadComponent: () => import('./laboratorio/laboratorio.component').then((m) => m.LaboratorioComponent),
  },
  {
    path: 'bono',
    title: 'Bono de transporte',
    canMatch: [conPermiso('cargas.ver')],
    loadComponent: () => import('./recepcion/bono-tramos.component').then((m) => m.BonoTramosComponent),
  },
  {
    path: 'productores/importar',
    title: 'Importar productores',
    canMatch: [conPermiso('cargas.catalogos')],
    loadComponent: () =>
      import('./catalogos/productores-importar.component').then((m) => m.ProductoresImportarComponent),
  },
  {
    path: 'productores',
    title: 'Productores',
    canMatch: [conPermiso('cargas.ver')],
    loadComponent: () => import('./catalogos/productores.component').then((m) => m.ProductoresComponent),
  },
  {
    path: 'cooperativas',
    title: 'Cooperativas',
    canMatch: [conPermiso('cargas.ver')],
    loadComponent: () => import('./catalogos/cooperativas.component').then((m) => m.CooperativasComponent),
  },
  {
    path: 'minas',
    title: 'Minas y bocaminas',
    canMatch: [conPermiso('cargas.ver')],
    loadComponent: () => import('./catalogos/minas.component').then((m) => m.MinasComponent),
  },
  {
    path: 'municipios',
    title: 'Municipios',
    canMatch: [conPermiso('cargas.ver')],
    loadComponent: () => import('./catalogos/municipios.component').then((m) => m.MunicipiosComponent),
  },
  {
    path: 'laboratorios',
    title: 'Laboratorios',
    canMatch: [conPermiso('cargas.ver')],
    loadComponent: () => import('./catalogos/laboratorios.component').then((m) => m.LaboratoriosComponent),
  },
  {
    path: 'bancos',
    title: 'Bancos',
    canMatch: [conPermiso('cargas.ver')],
    loadComponent: () => import('./catalogos/bancos.component').then((m) => m.BancosComponent),
  },
  {
    path: 'lineas',
    title: 'Líneas y elementos',
    canMatch: [conPermiso('cargas.ver')],
    loadComponent: () =>
      import('./configuracion/lineas-elementos.component').then((m) => m.LineasElementosComponent),
  },
  {
    path: 'series',
    title: 'Series de lote',
    canMatch: [conPermiso('cargas.ver')],
    loadComponent: () => import('./configuracion/series.component').then((m) => m.SeriesComponent),
  },
  {
    path: 'estado',
    title: 'Estado del módulo',
    canMatch: [conPermiso('cargas.ver')],
    loadComponent: () => import('./estado/estado.component').then((m) => m.EstadoCargasComponent),
  },
  { path: '', redirectTo: 'lotes', pathMatch: 'full' },
];
