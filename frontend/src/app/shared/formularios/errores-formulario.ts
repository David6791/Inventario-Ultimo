import { HttpErrorResponse } from '@angular/common/http';
import { FormGroup } from '@angular/forms';
import { signal } from '@angular/core';

/**
 * Manejo de errores de formulario, compartido por todas las pantallas.
 *
 * Se escribió después de resolver el mismo problema tres veces a mano: los
 * errores del servidor quedaban pegados mientras el usuario corregía, y si el
 * campo con problema estaba fuera de la pantalla no había forma de saber cuál
 * era.
 *
 * Uso:
 *   readonly errores = new ErroresFormulario(this.formulario, ETIQUETAS);
 *   ...
 *   error: (e) => this.errores.desdeServidor(e)
 */
export class ErroresFormulario {
  private readonly servidor = signal<Record<string, string[]>>({});

  /** Problemas a mostrar arriba del formulario tras intentar guardar. */
  readonly resumen = signal<string[]>([]);

  constructor(
    private readonly formulario: FormGroup,
    private readonly etiquetas: Record<string, string>,
  ) {
    // Un error del servidor deja de tener sentido apenas el usuario toca algo.
    this.formulario.valueChanges.subscribe(() => {
      if (Object.keys(this.servidor()).length) this.servidor.set({});
      if (this.resumen().length) this.resumen.set([]);
    });
  }

  /**
   * Mensaje bajo un campo, o null si está bien.
   *
   * El error del servidor gana sobre el del cliente: "ese código ya existe" es
   * más útil que "revise el código", y el navegador no puede saber lo primero.
   */
  de(campo: string): string | null {
    const delServidor = this.servidor()[campo]?.[0];
    if (delServidor) return delServidor;

    const control = this.formulario.get(campo);
    if (!control || control.valid || !(control.touched || control.dirty)) return null;

    const etiqueta = this.etiquetas[campo] ?? campo;
    const e = control.errors ?? {};

    if (e['required'])  return `${etiqueta} es obligatorio.`;
    if (e['email'])     return 'Escriba un correo electrónico válido.';
    if (e['min'])       return `El valor mínimo es ${e['min'].min}.`;
    if (e['pattern'])   return `${etiqueta} tiene caracteres no permitidos.`;
    if (e['minlength']) return `Use al menos ${e['minlength'].requiredLength} caracteres.`;
    if (e['maxlength']) return `No puede superar los ${e['maxlength'].requiredLength} caracteres.`;

    return `Revise ${etiqueta.toLowerCase()}.`;
  }

  /** Marca todo como tocado y arma el resumen. Devuelve si el formulario sirve. */
  validar(extras: string[] = []): boolean {
    this.formulario.markAllAsTouched();

    if (this.formulario.valid && !extras.length) {
      this.resumen.set([]);
      return true;
    }

    const problemas = Object.keys(this.formulario.controls)
      .map(campo => this.de(campo))
      .filter((m): m is string => m !== null);

    this.resumen.set([...problemas, ...extras]);
    return false;
  }

  /** Vuelca los errores 422 de Laravel en los campos y en el resumen. */
  desdeServidor(error: HttpErrorResponse): void {
    if (error.status !== 422) return;

    const errores: Record<string, string[]> = error.error?.errors ?? {};
    this.servidor.set(errores);
    this.resumen.set(Object.values(errores).map(m => m[0]));
  }

  limpiar(): void {
    this.servidor.set({});
    this.resumen.set([]);
  }
}
