import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AlmacenCatalogo, Categoria, Producto, ProductoBuscado, ProductoPayload, UnidadMedida,
} from '../models/catalogo.models';
import { Paginado } from '../models/auth.models';

export interface FiltroProductos {
  buscar?: string;
  categoria_id?: number;
  activo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  // --- Productos ---------------------------------------------------------

  productos(filtro: FiltroProductos = {}, pagina = 1): Observable<Paginado<Producto>> {
    let params = new HttpParams().set('page', pagina);

    Object.entries(filtro).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });

    return this.http.get<Paginado<Producto>>(`${this.api}/productos`, { params });
  }

  producto(id: number): Observable<{ data: Producto }> {
    return this.http.get<{ data: Producto }>(`${this.api}/productos/${id}`);
  }

  crearProducto(datos: ProductoPayload): Observable<Producto> {
    return this.http.post<Producto>(`${this.api}/productos`, datos);
  }

  actualizarProducto(id: number, datos: ProductoPayload): Observable<{ data: Producto }> {
    return this.http.put<{ data: Producto }>(`${this.api}/productos/${id}`, datos);
  }

  /** Da de baja o reactiva. El producto nunca se borra. */
  cambiarEstadoProducto(id: number, activo: boolean): Observable<{ data: Producto }> {
    return this.http.patch<{ data: Producto }>(`${this.api}/productos/${id}/estado`, { activo });
  }

  /** Buscador de los documentos de ingreso y salida. */
  buscarProductos(q: string): Observable<{ data: ProductoBuscado[] }> {
    return this.http.get<{ data: ProductoBuscado[] }>(`${this.api}/productos-buscar`, {
      params: new HttpParams().set('q', q),
    });
  }

  // --- Categorías --------------------------------------------------------

  categorias(soloActivas = false): Observable<{ data: Categoria[] }> {
    const params = soloActivas ? new HttpParams().set('solo_activas', true) : undefined;
    return this.http.get<{ data: Categoria[] }>(`${this.api}/categorias`, { params });
  }

  crearCategoria(datos: Partial<Categoria>): Observable<Categoria> {
    return this.http.post<Categoria>(`${this.api}/categorias`, datos);
  }

  actualizarCategoria(id: number, datos: Partial<Categoria>): Observable<{ data: Categoria }> {
    return this.http.put<{ data: Categoria }>(`${this.api}/categorias/${id}`, datos);
  }

  eliminarCategoria(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.api}/categorias/${id}`);
  }

  // --- Unidades de medida ------------------------------------------------

  unidades(soloActivas = false): Observable<{ data: UnidadMedida[] }> {
    const params = soloActivas ? new HttpParams().set('solo_activas', true) : undefined;
    return this.http.get<{ data: UnidadMedida[] }>(`${this.api}/unidades-medida`, { params });
  }

  crearUnidad(datos: Partial<UnidadMedida>): Observable<UnidadMedida> {
    return this.http.post<UnidadMedida>(`${this.api}/unidades-medida`, datos);
  }

  actualizarUnidad(id: number, datos: Partial<UnidadMedida>): Observable<{ data: UnidadMedida }> {
    return this.http.put<{ data: UnidadMedida }>(`${this.api}/unidades-medida/${id}`, datos);
  }

  eliminarUnidad(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.api}/unidades-medida/${id}`);
  }

  // --- Almacenes ---------------------------------------------------------

  almacenes(soloActivos = false): Observable<{ data: AlmacenCatalogo[] }> {
    const params = soloActivos ? new HttpParams().set('solo_activos', true) : undefined;
    return this.http.get<{ data: AlmacenCatalogo[] }>(`${this.api}/almacenes`, { params });
  }

  crearAlmacen(datos: Partial<AlmacenCatalogo>): Observable<AlmacenCatalogo> {
    return this.http.post<AlmacenCatalogo>(`${this.api}/almacenes`, datos);
  }

  actualizarAlmacen(id: number, datos: Partial<AlmacenCatalogo>): Observable<{ data: AlmacenCatalogo }> {
    return this.http.put<{ data: AlmacenCatalogo }>(`${this.api}/almacenes/${id}`, datos);
  }

  cambiarEstadoAlmacen(id: number, activo: boolean): Observable<{ data: AlmacenCatalogo }> {
    return this.http.patch<{ data: AlmacenCatalogo }>(`${this.api}/almacenes/${id}/estado`, { activo });
  }
}
