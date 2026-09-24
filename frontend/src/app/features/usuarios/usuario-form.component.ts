import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { PanelModule } from 'primeng/panel';
import { PasswordModule } from 'primeng/password';
import { Almacen, Rol, Usuario } from '../../core/models/auth.models';
import { PermisosService } from '../../core/services/permisos.service';
import { RolService } from '../../core/services/rol.service';
import { UsuarioService } from '../../core/services/usuario.service';

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, ButtonModule, InputTextModule, PasswordModule,
    MultiSelectModule, DropdownModule, CheckboxModule, PanelModule, MessageModule,
  ],
  template: `
    <form [formGroup]="formulario" (ngSubmit)="guardar()">

      <header class="encabezado">
        <div>
          <h1>{{ esNuevo() ? 'Registrar usuario' : usuario()?.name }}</h1>
          <p>Los roles definen qué puede hacer. Los almacenes definen sobre cuáles
             existencias puede trabajar.</p>
        </div>
        <div class="botones">
          <button pButton type="button" label="Cancelar" severity="secondary" text
                  (click)="volver()"></button>
          <button pButton type="submit" icon="pi pi-check"
                  [label]="esNuevo() ? 'Registrar usuario' : 'Guardar cambios'"
                  [loading]="guardando()"></button>
        </div>
      </header>

      @if (resumenErrores().length) {
        <div class="resumen-errores" role="alert">
          <div class="titulo">
            <i class="pi pi-exclamation-circle"></i>
            <span>Revise {{ resumenErrores().length === 1 ? 'este punto' : 'estos puntos' }} antes de guardar</span>
          </div>
          <ul>
            @for (problema of resumenErrores(); track problema) {
              <li>{{ problema }}</li>
            }
          </ul>
        </div>
      }

      <p-panel header="Datos personales">
        <div class="rejilla">
          <div class="campo">
            <label for="name">Nombre completo</label>
            <input pInputText id="name" formControlName="name"
                   [class.ng-invalid-visible]="mensajeError('name')" />
            @if (mensajeError('name')) { <small class="error">{{ mensajeError('name') }}</small> }
          </div>

          <div class="campo">
            <label for="ci">Carnet de identidad</label>
            <input pInputText id="ci" formControlName="ci" placeholder="Opcional"
                   [class.ng-invalid-visible]="mensajeError('ci')" />
            @if (mensajeError('ci')) { <small class="error">{{ mensajeError('ci') }}</small> }
          </div>

          <div class="campo">
            <label for="email">Correo electrónico</label>
            <input pInputText id="email" type="email" formControlName="email"
                   [class.ng-invalid-visible]="mensajeError('email')" />
            @if (mensajeError('email')) { <small class="error">{{ mensajeError('email') }}</small> }
          </div>

          <div class="campo">
            <label for="cargo">Cargo</label>
            <input pInputText id="cargo" formControlName="cargo" placeholder="Opcional" />
          </div>

          <div class="campo">
            <label for="telefono">Teléfono</label>
            <input pInputText id="telefono" formControlName="telefono" placeholder="Opcional" />
          </div>
        </div>
      </p-panel>

      <p-panel [header]="esNuevo() ? 'Contraseña inicial' : 'Cambiar contraseña'">
        @if (!esNuevo()) {
          <p class="nota">Deje ambos campos vacíos para conservar la contraseña actual.</p>
        }
        <div class="rejilla">
          <div class="campo">
            <label for="password">Contraseña</label>
            <p-password inputId="password" formControlName="password" [feedback]="true"
                        [toggleMask]="true" styleClass="ancho" inputStyleClass="ancho"
                        promptLabel="Mínimo 8 caracteres con letras y números"
                        weakLabel="Débil" mediumLabel="Aceptable" strongLabel="Fuerte" />
            @if (mensajeError('password')) {
              <small class="error">{{ mensajeError('password') }}</small>
            }
          </div>

          <div class="campo">
            <label for="password_confirmation">Repetir contraseña</label>
            <p-password inputId="password_confirmation" formControlName="password_confirmation"
                        [feedback]="false" [toggleMask]="true"
                        styleClass="ancho" inputStyleClass="ancho" />
            @if (clavesNoCoinciden()) {
              <small class="error">Las contraseñas no coinciden.</small>
            }
          </div>
        </div>
        <p class="nota">El usuario deberá cambiarla la primera vez que ingrese.</p>
      </p-panel>

      <p-panel header="Roles">
        <p-multiSelect [options]="rolesDisponibles()" formControlName="roles"
                       optionLabel="name" optionValue="name" display="chip"
                       placeholder="Seleccione uno o más roles" styleClass="ancho"
                       [filter]="true" filterPlaceHolder="Buscar rol">
          <ng-template let-rol pTemplate="item">
            <div class="opcion-rol">
              <span class="nombre">{{ rol.name }}</span>
              <span class="detalle">{{ rol.descripcion }}</span>
            </div>
          </ng-template>
        </p-multiSelect>
        @if (mensajeError('roles')) {
          <small class="error">{{ mensajeError('roles') }}</small>
        }
      </p-panel>

      <p-panel header="Almacenes asignados">
        <p class="nota">El usuario solo verá existencias y documentos de estos almacenes.</p>

        <div class="rejilla">
          <div class="campo">
            <label>Almacenes con acceso</label>
            <p-multiSelect [options]="almacenes()" formControlName="almacenes"
                           optionLabel="nombre" optionValue="id" display="chip"
                           placeholder="Seleccione los almacenes" styleClass="ancho"
                           (onChange)="ajustarPredeterminado()" />
          </div>

          <div class="campo">
            <label>Almacén predeterminado</label>
            <p-dropdown [options]="almacenesElegidos()" formControlName="almacen_predeterminado_id"
                        optionLabel="nombre" optionValue="id" styleClass="ancho"
                        placeholder="Elija cuál se abre al ingresar"
                        [disabled]="!almacenesElegidos().length" />
          </div>
        </div>

        @if (!formulario.value.almacenes?.length) {
          <p-message severity="warn" styleClass="ancho-total"
            text="Sin almacenes asignados el usuario podrá ingresar, pero no verá ninguna existencia ni podrá registrar movimientos." />
        }
      </p-panel>
    </form>
  `,
  styles: [`
    .encabezado { display:flex; justify-content:space-between; align-items:flex-start;
                  gap:2rem; margin-bottom:1.25rem; }
    .encabezado h1 { margin:0 0 .25rem; font-size:1.4rem; font-weight:600; }
    .encabezado p  { margin:0; max-width:56ch; color:var(--text-color-secondary);
                     font-size:.875rem; line-height:1.5; }
    .botones { display:flex; gap:.5rem; }

    :host ::ng-deep p-panel { display:block; margin-bottom:1rem; }
    :host ::ng-deep .ancho { width:100%; }
    .ancho-total { display:block; margin-top:.75rem; }

    .rejilla { display:grid; grid-template-columns:repeat(auto-fit, minmax(17rem, 1fr));
               gap:1rem 1.25rem; }
    .campo { display:flex; flex-direction:column; gap:.375rem; }
    .campo label { font-size:.8125rem; font-weight:500; }
    .campo input { width:100%; }
    .error { color:var(--red-500); font-size:.75rem; }
    .nota { font-size:.8125rem; color:var(--text-color-secondary); margin:0 0 .875rem; }

    /* Borde rojo solo cuando ya mostramos el mensaje, no mientras escribe. */
    :host ::ng-deep .ng-invalid-visible { border-color:var(--red-400) !important; }

    .resumen-errores { border:1px solid var(--red-200); background:var(--red-50);
                       border-radius:8px; padding:.875rem 1rem; margin-bottom:1rem; }
    .resumen-errores .titulo { display:flex; align-items:center; gap:.5rem;
                               font-weight:600; color:var(--red-700);
                               font-size:.875rem; margin-bottom:.375rem; }
    .resumen-errores ul { margin:0; padding-left:1.75rem; color:var(--red-700);
                          font-size:.8125rem; line-height:1.6; }

    .opcion-rol { display:flex; flex-direction:column; }
    .opcion-rol .nombre { font-weight:500; }
    .opcion-rol .detalle { font-size:.75rem; color:var(--text-color-secondary); }

    @media (max-width: 60rem) { .encabezado { flex-direction:column; } }
  `],
})
export class UsuarioFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly servicio = inject(UsuarioService);
  private readonly rolServicio = inject(RolService);
  private readonly permisos = inject(PermisosService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  readonly id = input<string | undefined>();

  readonly usuario = signal<Usuario | null>(null);
  readonly roles = signal<Rol[]>([]);
  readonly almacenes = signal<Almacen[]>([]);
  readonly guardando = signal(false);
  readonly erroresServidor = signal<Record<string, string[]>>({});

  readonly esNuevo = computed(() => !this.id());

  /** Errores acumulados al intentar guardar, para el resumen de arriba. */
  readonly resumenErrores = signal<string[]>([]);

  /** Nombre visible de cada campo. Se usa en los mensajes y en el resumen. */
  private static readonly ETIQUETAS: Record<string, string> = {
    name: 'Nombre completo',
    ci: 'Carnet de identidad',
    email: 'Correo electrónico',
    cargo: 'Cargo',
    telefono: 'Teléfono',
    password: 'Contraseña',
    password_confirmation: 'Repetir contraseña',
    roles: 'Roles',
    almacenes: 'Almacenes',
    almacen_predeterminado_id: 'Almacén predeterminado',
  };

  /** Solo un super-admin puede repartir el rol super-admin. */
  readonly rolesDisponibles = computed(() =>
    this.permisos.tieneRol('super-admin')
      ? this.roles()
      : this.roles().filter(r => r.name !== 'super-admin'));

  readonly formulario = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    ci: [''],
    email: ['', [Validators.required, Validators.email]],
    cargo: [''],
    telefono: [''],
    password: [''],
    password_confirmation: [''],
    roles: [[] as string[], [Validators.required, Validators.minLength(1)]],
    almacenes: [[] as number[]],
    almacen_predeterminado_id: [null as number | null],
  }, {
    // A nivel de formulario, no de campo: el desajuste involucra a dos
    // controles y ninguno de los dos es "el que está mal" por sí solo.
    validators: (grupo) => {
      const clave = grupo.get('password')?.value;
      const repetida = grupo.get('password_confirmation')?.value;
      return clave && repetida && clave !== repetida ? { clavesDistintas: true } : null;
    },
  });

  readonly almacenesElegidos = signal<Almacen[]>([]);

  /*
   | En ngOnInit, no en el constructor: los input() de señal todavía no tienen
   | valor cuando el constructor corre, asi que this.id() daba undefined y el
   | formulario se comportaba siempre como alta de usuario nuevo.
   |
   | Ademas forkJoin en vez de tres subscribe sueltos: patchValue debe correr
   | DESPUES de que lleguen roles y almacenes. Si se adelanta, p-multiSelect
   | recibe identificadores que aun no existen entre sus opciones y los descarta
   | en silencio.
   */
  ngOnInit(): void {
    // Un error del servidor deja de tener sentido apenas el usuario toca algo:
    // si sigue en pantalla mientras corrige, parece que el sistema no responde.
    this.formulario.valueChanges.subscribe(() => {
      if (Object.keys(this.erroresServidor()).length) {
        this.erroresServidor.set({});
      }
      if (this.resumenErrores().length) {
        this.resumenErrores.set([]);
      }
    });

    const id = this.id();

    if (!id) {
      // En alta la contraseña es obligatoria; al editar es opcional.
      this.formulario.controls.password.addValidators([
        Validators.required, Validators.minLength(8),
      ]);
      this.formulario.controls.password.updateValueAndValidity();
    }

    forkJoin({
      roles: this.rolServicio.listar('', 1),
      almacenes: this.servicio.almacenes(),
      usuario: id ? this.servicio.obtener(Number(id)) : of(null),
    }).subscribe(({ roles, almacenes, usuario }) => {
      this.roles.set(roles.data);
      this.almacenes.set(almacenes.data);

      if (usuario) {
        this.rellenar(usuario.data);
      }

      this.ajustarPredeterminado();
    });
  }

  private rellenar(usuario: Usuario): void {
    this.usuario.set(usuario);

    this.formulario.patchValue({
      name: usuario.name,
      ci: usuario.ci ?? '',
      email: usuario.email,
      cargo: usuario.cargo ?? '',
      telefono: usuario.telefono ?? '',
      roles: (usuario.roles ?? []).map(r => r.name),
      almacenes: (usuario.almacenes ?? []).map(a => a.id),
      almacen_predeterminado_id:
        (usuario.almacenes ?? []).find(a => a.es_predeterminado)?.id ?? null,
    });
  }

  /**
   * Mensaje a mostrar bajo un campo, o null si está bien.
   *
   * Prioriza el error del servidor sobre el del cliente: si el backend dijo
   * "ese correo ya está registrado", eso es más útil que "escriba un correo
   * válido". El cliente no puede saber lo primero.
   */
  mensajeError(campo: string): string | null {
    const delServidor = this.erroresServidor()[campo]?.[0];
    if (delServidor) {
      return delServidor;
    }

    const control = this.formulario.get(campo);
    if (!control || control.valid || !(control.touched || control.dirty)) {
      return null;
    }

    const etiqueta = UsuarioFormComponent.ETIQUETAS[campo] ?? campo;
    const errores = control.errors ?? {};

    if (errores['required'])  return `${etiqueta} es obligatorio.`;
    if (errores['email'])     return 'Escriba un correo electrónico válido.';
    if (errores['minlength']) {
      return `Use al menos ${errores['minlength'].requiredLength} caracteres.`;
    }
    if (errores['maxlength']) {
      return `No puede superar los ${errores['maxlength'].requiredLength} caracteres.`;
    }

    return `Revise ${etiqueta.toLowerCase()}.`;
  }

  /** El desajuste de contraseñas vive en el formulario, no en un campo. */
  clavesNoCoinciden(): boolean {
    return this.formulario.hasError('clavesDistintas')
      && !!this.formulario.getRawValue().password_confirmation;
  }

  /** Recorre el formulario y arma la lista de problemas para el resumen. */
  private recolectarErrores(): string[] {
    const problemas: string[] = [];

    Object.keys(this.formulario.controls).forEach(campo => {
      const mensaje = this.mensajeError(campo);
      if (mensaje) {
        problemas.push(mensaje);
      }
    });

    if (this.formulario.hasError('clavesDistintas')) {
      problemas.push('Las contraseñas no coinciden.');
    }

    return problemas;
  }

  /** Mantiene el desplegable de predeterminado en sincronía con lo seleccionado. */
  ajustarPredeterminado(): void {
    const ids = this.formulario.getRawValue().almacenes ?? [];
    const elegidos = this.almacenes().filter(a => ids.includes(a.id));
    this.almacenesElegidos.set(elegidos);

    const actual = this.formulario.getRawValue().almacen_predeterminado_id;

    if (!elegidos.length) {
      this.formulario.patchValue({ almacen_predeterminado_id: null }, { emitEvent: false });
      return;
    }

    if (!actual || !ids.includes(actual)) {
      this.formulario.patchValue(
        { almacen_predeterminado_id: elegidos[0].id }, { emitEvent: false },
      );
    }
  }

  guardar(): void {
    this.formulario.markAllAsTouched();

    if (this.formulario.invalid) {
      // El resumen se muestra arriba del formulario: si el campo con problema
      // quedó fuera de la pantalla, el usuario igual sabe qué corregir.
      this.resumenErrores.set(this.recolectarErrores());
      return;
    }

    this.resumenErrores.set([]);

    this.guardando.set(true);
    this.erroresServidor.set({});

    const valores = this.formulario.getRawValue();

    const payload = {
      ci: valores.ci || null,
      name: valores.name,
      email: valores.email,
      cargo: valores.cargo || null,
      telefono: valores.telefono || null,
      roles: valores.roles,
      almacenes: valores.almacenes,
      almacen_predeterminado_id: valores.almacen_predeterminado_id,
      ...(valores.password
        ? { password: valores.password, password_confirmation: valores.password_confirmation }
        : {}),
    };

    const id = this.id();

    // Tipado explicito: crear() devuelve Usuario y actualizar() devuelve
    // { data: Usuario }. Sin esto TypeScript arma un tipo union cuyo subscribe
    // no es invocable (TS2349), porque las firmas de ambos no son compatibles.
    const peticion: Observable<unknown> = id
      ? this.servicio.actualizar(Number(id), payload)
      : this.servicio.crear(payload);

    peticion.subscribe({
      next: () => {
        this.mensajes.add({
          severity: 'success',
          summary: id ? 'Usuario actualizado' : 'Usuario registrado',
          detail: valores.name,
        });
        this.router.navigate(['/usuarios']);
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);

        if (error.status !== 422) {
          return;
        }

        const errores: Record<string, string[]> = error.error?.errors ?? {};
        this.erroresServidor.set(errores);
        this.resumenErrores.set(Object.values(errores).map(m => m[0]));
      },
    });
  }

  volver(): void {
    this.router.navigate(['/usuarios']);
  }
}
