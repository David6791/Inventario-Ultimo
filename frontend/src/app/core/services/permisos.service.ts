import { Injectable, computed, signal } from '@angular/core';
import { AlmacenAsignado, Perfil } from '../models/auth.models';

const CLAVE_ALMACEN = 'inv.almacen_activo';

/**
 * Estado de autorización del cliente.
 *
 * Importante: esto es UX, no seguridad. Sirve para no mostrar botones que van a
 * fallar. La autorización de verdad la aplica Laravel en cada request; si acá
 * hubiera un error, el peor caso es un 403 — nunca un acceso indebido.
 */
@Injectable({ providedIn: 'root' })
export class PermisosService {
  private readonly _perfil = signal<Perfil | null>(null);
  private readonly _almacenActivoId = signal<number | null>(this.leerAlmacenGuardado());

  /** Set para que `can()` sea O(1); se consulta en cada render de directiva. */
  private readonly indice = computed(() => new Set(this._perfil()?.permisos ?? []));

  readonly perfil = this._perfil.asReadonly();
  readonly usuario = computed(() => this._perfil()?.usuario ?? null);
  readonly roles = computed(() => this._perfil()?.roles ?? []);
  readonly almacenes = computed<AlmacenAsignado[]>(() => this._perfil()?.almacenes ?? []);
  readonly autenticado = computed(() => this._perfil() !== null);

  readonly almacenActivo = computed<AlmacenAsignado | null>(() => {
    const lista = this.almacenes();
    if (!lista.length) return null;
    const id = this._almacenActivoId();
    return lista.find(a => a.id === id)
      ?? lista.find(a => a.es_predeterminado)
      ?? lista[0];
  });

  establecerPerfil(perfil: Perfil | null): void {
    this._perfil.set(perfil);

    // El almacen guardado puede pertenecer a otro usuario (el que uso este
    // navegador antes) o haber sido desasignado por el administrador. En ambos
    // casos se descarta y se toma el que corresponda.
    const guardado = this._almacenActivoId();
    const accesible = perfil?.almacenes.some(a => a.id === guardado) ?? false;

    if (!accesible) {
      this._almacenActivoId.set(null);
      localStorage.removeItem(CLAVE_ALMACEN);
    }

    const activo = this.almacenActivo();
    if (activo) {
      this.cambiarAlmacen(activo.id);
    }
  }

  /**
   * Ignora los valores nulos y los que no cambian nada.
   *
   * Los componentes de formulario emiten su evento de cambio al inicializarse,
   * asi que sin esta guarda una simple carga de pantalla se interpreta como una
   * eleccion del usuario.
   */
  cambiarAlmacen(id: number | null | undefined): void {
    if (id == null || id === this._almacenActivoId()) {
      return;
    }

    this._almacenActivoId.set(id);
    localStorage.setItem(CLAVE_ALMACEN, String(id));
  }

  limpiar(): void {
    this._perfil.set(null);
    this._almacenActivoId.set(null);
    localStorage.removeItem(CLAVE_ALMACEN);
  }

  can(permiso: string): boolean {
    return this.indice().has(permiso);
  }

  canAlguno(permisos: string[]): boolean {
    return permisos.some(p => this.indice().has(p));
  }

  canTodos(permisos: string[]): boolean {
    return permisos.every(p => this.indice().has(p));
  }

  tieneRol(rol: string): boolean {
    return this.roles().includes(rol);
  }

  private leerAlmacenGuardado(): number | null {
    const guardado = localStorage.getItem(CLAVE_ALMACEN);
    return guardado ? Number(guardado) : null;
  }
}
