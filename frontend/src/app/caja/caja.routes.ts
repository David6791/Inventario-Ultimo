import { Routes } from '@angular/router';
import { conAlgunPermiso, conPermiso } from '../core/guards/permisos.guard';

/**
 * Módulo de caja (/caja). Leer exige caja.ver; los botones de escritura se
 * ocultan con *appTienePermiso y el backend vuelve a verificar, sede incluida.
 */
export const CAJA_ROUTES: Routes = [
  {
    path: 'operar',
    title: 'Caja',
    canMatch: [conPermiso('caja.ver')],
    loadComponent: () => import('./operacion/mis-cajas.component').then((m) => m.MisCajasComponent),
  },
  {
    path: 'operar/:id',
    title: 'Caja',
    canMatch: [conPermiso('caja.ver')],
    loadComponent: () => import('./operacion/caja-operacion.component').then((m) => m.CajaOperacionComponent),
  },
  {
    path: 'operar/:id/cierre',
    title: 'Cerrar caja',
    canMatch: [conPermiso('caja.cerrar')],
    loadComponent: () => import('./operacion/cierre-caja.component').then((m) => m.CierreCajaComponent),
  },
  {
    path: 'cierres',
    title: 'Cierres de caja',
    canMatch: [conPermiso('caja.ver')],
    loadComponent: () => import('./reportes/cierres.component').then((m) => m.CierresCajaComponent),
  },
  {
    path: 'libro',
    title: 'Libro de caja',
    canMatch: [conPermiso('caja.reportes')],
    loadComponent: () => import('./reportes/libro-caja.component').then((m) => m.LibroCajaComponent),
  },
  {
    path: 'cajas',
    title: 'Cajas',
    canMatch: [conPermiso('caja.administrar')],
    loadComponent: () => import('./configuracion/cajas.component').then((m) => m.CajasComponent),
  },
  {
    path: 'conceptos',
    title: 'Conceptos de caja',
    canMatch: [conPermiso('caja.ver')],
    loadComponent: () => import('./configuracion/conceptos.component').then((m) => m.ConceptosCajaComponent),
  },
  {
    path: 'personas',
    title: 'Personas',
    canMatch: [conPermiso('caja.ver')],
    loadComponent: () => import('./configuracion/personas.component').then((m) => m.PersonasCajaComponent),
  },
  {
    path: 'solicitudes',
    title: 'Solicitudes de dinero',
    canMatch: [conAlgunPermiso(['caja.solicitar', 'caja.registrar'])],
    loadComponent: () => import('./solicitudes/solicitudes.component').then((m) => m.SolicitudesCajaComponent),
  },
  {
    path: 'aprobaciones',
    title: 'Aprobación de solicitudes',
    canMatch: [conPermiso('caja.aprobar')],
    loadComponent: () => import('./solicitudes/aprobaciones.component').then((m) => m.AprobacionesCajaComponent),
  },
  { path: '', redirectTo: 'operar', pathMatch: 'full' },
];
