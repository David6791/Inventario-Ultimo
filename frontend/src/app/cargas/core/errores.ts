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
  return primero ?? error?.message ?? error?.mensaje ?? porDefecto;
}
