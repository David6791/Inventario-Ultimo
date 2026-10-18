import { HttpErrorResponse } from '@angular/common/http';

/**
 * Texto para mostrar cuando el servidor rechaza un guardado.
 *
 * Prioridad: el primer error de campo (validación de Laravel), después el
 * mensaje general. Las reglas que vive en la base (triggers, CHECK, UNIQUE)
 * llegan como 422 con `message` ya en español (ErrorBaseDatos del backend).
 */
export function mensajeDeError(e: unknown, porDefecto = 'Revise los datos.'): string {
  const error = (e as HttpErrorResponse)?.error;
  const campos = error?.errors as Record<string, string[]> | undefined;
  const primero = campos ? Object.values(campos)[0]?.[0] : undefined;
  const estado = (e as HttpErrorResponse)?.status;
  // Sin mensaje útil del servidor, al menos decir qué pasó.
  const porEstado: Record<number, string> = {
    0: 'El servidor no responde. Revise que el backend esté levantado.',
    403: 'Su usuario no tiene permiso para esto. Pida un rol de cargas (por ejemplo «Jefe de Compras de Mineral»).',
    404: 'El servidor no conoce esta ruta: el backend no tiene la última versión del módulo de cargas.',
    500: 'Error interno del servidor. Revise storage/logs/laravel.log.',
  };
  if (estado === 403 || estado === 404 || estado === 0) return porEstado[estado];
  return primero ?? error?.message ?? error?.mensaje ?? porEstado[estado] ?? porDefecto;
}
