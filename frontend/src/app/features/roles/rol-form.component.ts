import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { MessageModule } from 'primeng/message';
import { PanelModule } from 'primeng/panel';
import { ModuloPermisos, Rol } from '../../core/models/auth.models';
import { PermisosService } from '../../core/services/permisos.service';
import { RolService } from '../../core/services/rol.service';

@Component({
  selector: 'app-rol-form',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, FormsModule, ButtonModule, InputTextModule, InputTextareaModule,
    CheckboxModule, PanelModule, MessageModule,
  ],
  template: `
    <form [formGroup]="formulario" (ngSubmit)="guardar()">

      <header class="encabezado">
        <div>
          <h1>{{ esNuevo() ? 'Crear rol' : rol()?.name }}</h1>
          <p>Marque lo que este rol puede hacer. Los permisos no otorgan acceso a
             almacenes: eso se define usuario por usuario.</p>
        </div>
        <div class="botones">
          <button pButton type="button" label="Cancelar" severity="secondary" text
                  (click)="volver()"></button>
          @if (editable()) {
            <button pButton type="submit" icon="pi pi-check" label="Guardar rol"
                    [loading]="guardando()"></button>
          }
        </div>
      </header>

      @if (!editable() && !esNuevo()) {
        <p-message severity="info" styleClass="ancho-total"
          [text]="motivoSoloLectura()" />
      }

      <section class="datos">
        <div class="campo">
          <label for="nombre">Nombre del rol</label>
          <input pInputText id="nombre" formControlName="name"
                 placeholder="Por ejemplo: encargado de suministros" />
          @if (invalido('name')) {
            <small class="error">Escriba un nombre de hasta 60 caracteres.</small>
          }
        </div>

        <div class="campo">
          <label for="descripcion">Descripción</label>
          <textarea pInputTextarea id="descripcion" formControlName="descripcion" rows="2"
                    placeholder="Qué hace esta persona en el sistema"></textarea>
        </div>
      </section>

      <div class="resumen">
        <span><strong>{{ seleccionados().size }}</strong> de {{ totalPermisos() }} permisos</span>
        @if (editable()) {
          <div>
            <button pButton type="button" label="Marcar todos" text size="small"
                    (click)="marcarTodos(true)"></button>
            <button pButton type="button" label="Desmarcar todos" text size="small"
                    (click)="marcarTodos(false)"></button>
          </div>
        }
      </div>

      @for (modulo of catalogo(); track modulo.clave) {
        <p-panel [toggleable]="true" styleClass="modulo">
          <ng-template pTemplate="header">
            <div class="cabecera-modulo">
              <i [class]="modulo.icono"></i>
              <span>{{ modulo.etiqueta }}</span>
              <span class="conteo">{{ contarModulo(modulo) }}/{{ modulo.permisos.length }}</span>
            </div>
          </ng-template>

          <ng-template pTemplate="icons">
            @if (editable()) {
              <button pButton type="button" text size="small"
                      [label]="contarModulo(modulo) === modulo.permisos.length ? 'Quitar todo' : 'Marcar todo'"
                      (click)="alternarModulo(modulo, $event)"></button>
            }
          </ng-template>

          <div class="rejilla">
            @for (permiso of modulo.permisos; track permiso.nombre) {
              <label class="permiso" [class.deshabilitado]="!editable()">
                <p-checkbox [binary]="true" [disabled]="!editable()"
                            [ngModelOptions]="{standalone: true}"
                            [ngModel]="seleccionados().has(permiso.nombre)"
                            (ngModelChange)="alternar(permiso.nombre, $event)" />
                <span>
                  <span class="descripcion">{{ permiso.descripcion }}</span>
                  <code>{{ permiso.nombre }}</code>
                </span>
              </label>
            }
          </div>
        </p-panel>
      }
    </form>
  `,
  styles: [`
    .encabezado { display:flex; justify-content:space-between; align-items:flex-start;
                  gap:2rem; margin-bottom:1.25rem; }
    .encabezado h1 { margin:0 0 .25rem; font-size:1.4rem; font-weight:600; }
    .encabezado p  { margin:0; max-width:56ch; color:var(--text-color-secondary);
                     font-size:.875rem; line-height:1.5; }
    .botones { display:flex; gap:.5rem; }
    .ancho-total { display:block; margin-bottom:1rem; }

    .datos { display:grid; grid-template-columns:minmax(0,22rem) minmax(0,1fr);
             gap:1.25rem; margin-bottom:1.5rem; }
    .campo { display:flex; flex-direction:column; gap:.375rem; }
    .campo label { font-size:.8125rem; font-weight:500; }
    .campo input, .campo textarea { width:100%; }

    .fallo { display:flex; align-items:center; gap:.75rem; padding:.875rem 1rem;
             margin-bottom:1.25rem; border:1px solid var(--alerta);
             border-left-width:3px; border-radius:var(--radio);
             background:var(--alerta-lavado); font-size:var(--t-sm); }
    .fallo i { color:var(--alerta); }
    .fallo span { flex:1; }
    .error { color:var(--red-500); font-size:.75rem; }

    .resumen { display:flex; justify-content:space-between; align-items:center;
               padding:.625rem .875rem; margin-bottom:.75rem; border-radius:6px;
               background:var(--surface-100); font-size:.875rem; }

    :host ::ng-deep .modulo { margin-bottom:.625rem; }
    .cabecera-modulo { display:flex; align-items:center; gap:.625rem; font-weight:500; }
    .conteo { color:var(--text-color-secondary); font-size:.8125rem; font-weight:400; }

    .rejilla { display:grid; grid-template-columns:repeat(auto-fill, minmax(19rem, 1fr));
               gap:.625rem 1.25rem; }
    .permiso { display:flex; align-items:flex-start; gap:.625rem; cursor:pointer;
               padding:.25rem 0; }
    .permiso.deshabilitado { cursor:default; opacity:.65; }
    .permiso span { display:flex; flex-direction:column; gap:.125rem; }
    .descripcion { font-size:.875rem; line-height:1.35; }
    .permiso code { font-size:.6875rem; color:var(--text-color-secondary); }

    @media (max-width: 60rem) {
      .datos { grid-template-columns:1fr; }
      .encabezado { flex-direction:column; }
    }
  `],
})
export class RolFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly servicio = inject(RolService);
  private readonly permisosUsuario = inject(PermisosService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  /** Llega por withComponentInputBinding desde la ruta roles/:id */
  readonly id = input<string | undefined>();

  readonly rol = signal<Rol | null>(null);
  readonly catalogo = signal<ModuloPermisos[]>([]);
  readonly seleccionados = signal<Set<string>>(new Set());
  readonly guardando = signal(false);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  readonly esNuevo = computed(() => !this.id());
  readonly totalPermisos = computed(() =>
    this.catalogo().reduce((n, m) => n + m.permisos.length, 0));

  readonly editable = computed(() => {
    if (this.esNuevo()) return this.permisosUsuario.can('roles.crear');
    return this.rol()?.puede_editarse ?? false;
  });

  readonly formulario = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    descripcion: [''],
  });

  /*
   | En ngOnInit, no en el constructor: los input() de señal todavia no tienen
   | valor cuando el constructor corre, asi que this.id() daba undefined y el
   | formulario siempre se comportaba como creacion de rol nuevo.
   */
  ngOnInit(): void {
    this.servicio.catalogoPermisos().subscribe(res => this.catalogo.set(res.data));

    const id = this.id();
    if (!id) {
      return;
    }

    this.cargando.set(true);

    this.servicio.obtener(Number(id)).subscribe({
      next: res => {
        const rol = res.data;
        this.rol.set(rol);
        this.formulario.patchValue({ name: rol.name, descripcion: rol.descripcion ?? '' });
        this.seleccionados.set(new Set(rol.permisos ?? []));

        if (!rol.puede_editarse) {
          this.formulario.disable();
        } else if (rol.es_sistema) {
          this.formulario.controls.name.disable();
        }

        this.cargando.set(false);
      },
      /*
       | Si la carga falla, el formulario se quedaba vacío haciéndose pasar por
       | uno de creación: guardar habría creado un rol nuevo en vez de editar el
       | existente. Mejor decirlo y volver a la lista.
       */
      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(
          error.status === 404
            ? 'Ese rol ya no existe.'
            : 'No se pudo cargar el rol. ' + (error.error?.message ?? 'Intente nuevamente.')
        );
      },
    });
  }

  motivoSoloLectura(): string {
    const rol = this.rol();
    if (!rol) return '';
    if (rol.name === 'super-admin') {
      return 'El rol de administrador tiene acceso total por diseño y no se edita.';
    }
    return 'Está viendo este rol en modo consulta. No puede editar un rol que usted mismo tiene asignado, ni le alcanzan los permisos para hacerlo.';
  }

  invalido(campo: string): boolean {
    const control = this.formulario.get(campo);
    return !!control && control.invalid && control.touched;
  }

  contarModulo(modulo: ModuloPermisos): number {
    const marcados = this.seleccionados();
    return modulo.permisos.filter(p => marcados.has(p.nombre)).length;
  }

  alternar(permiso: string, valor: boolean): void {
    if (!this.editable()) return;

    this.seleccionados.update(actual => {
      const copia = new Set(actual);
      valor ? copia.add(permiso) : copia.delete(permiso);
      return copia;
    });
  }

  alternarModulo(modulo: ModuloPermisos, evento: Event): void {
    evento.stopPropagation();
    const completo = this.contarModulo(modulo) === modulo.permisos.length;

    this.seleccionados.update(actual => {
      const copia = new Set(actual);
      modulo.permisos.forEach(p => completo ? copia.delete(p.nombre) : copia.add(p.nombre));
      return copia;
    });
  }

  marcarTodos(valor: boolean): void {
    if (!valor) { this.seleccionados.set(new Set()); return; }

    this.seleccionados.set(new Set(
      this.catalogo().flatMap(m => m.permisos.map(p => p.nombre)),
    ));
  }

  guardar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    if (this.seleccionados().size === 0) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Rol sin permisos',
        detail: 'Marque al menos un permiso; si no, el rol no sirve de nada.',
      });
      return;
    }

    this.guardando.set(true);

    const payload = {
      name: this.formulario.getRawValue().name,
      descripcion: this.formulario.getRawValue().descripcion || null,
      permisos: [...this.seleccionados()],
    };

    const id = this.id();

    // Tipado explicito: crear() devuelve Rol y actualizar() devuelve
    // { data: Rol }. Sin esto TypeScript arma un tipo union cuyo subscribe no
    // es invocable (TS2349).
    const peticion: Observable<unknown> = id
      ? this.servicio.actualizar(Number(id), payload)
      : this.servicio.crear(payload);

    peticion.subscribe({
      next: () => {
        this.mensajes.add({
          severity: 'success',
          summary: id ? 'Rol actualizado' : 'Rol creado',
          detail: `${payload.name} — ${payload.permisos.length} permisos.`,
        });
        this.router.navigate(['/roles']);
      },
      error: () => this.guardando.set(false),
    });
  }

  volver(): void {
    this.router.navigate(['/roles']);
  }
}