import { Routes } from '@angular/router';
import { conPermiso } from '../core/guards/permisos.guard';

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
  { path: '', redirectTo: 'operar', pathMatch: 'full' },
];
