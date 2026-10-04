import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { environment } from '../../../environments/environment';
import { ActivoService } from '../core/services/activo.service';
import { CatalogoService } from '../core/services/catalogo.service';
import { DocumentoService } from '../core/services/documento.service';
import { TIPOS_DOCUMENTO, TipoDocumento } from '../core/models/documento.model';
import { ActivoLista } from '../core/models/activo.model';
import { Ubicacion } from '../core/models/catalogo.model';
import { ESTILOS_CONFIG } from '../core/estilos/configuracion.estilos';

interface Usuario { id: number; name: string; cargo?: string | null; }

@Component({
  selector: 'app-documento-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, CalendarModule,
    DropdownModule, InputTextModule, InputTextareaModule, TableModule, TagModule, ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <button class="volver" type="button" (click)="volver()">
          <i class="pi pi-arrow-left"></i> Custodia
        </button>
        <h2>Nuevo documento de custodia</h2>
      </div>
    </header>

    <!-- ================================================== 1. Tipo de acto -->
    <section class="bloque">
      <div class="bloque-titulo">
        <span class="numero">1</span>
        <div>
          <h3>¿Qué se va a hacer?</h3>
          <p>El tipo determina qué bienes se pueden incluir y qué datos hacen falta.</p>
        </div>
      </div>

      <div class="tipos">
        <button *ngFor="let t of tipos" type="button" class="tarjeta-tipo"
                [class.elegida]="tipo() === t.valor" (click)="elegirTipo(t.valor)">
          <i [class]="t.icono"></i>
          <span class="nombre">{{ t.etiqueta }}</span>
          <span class="desc">{{ t.descripcion }}</span>
        </button>
      </div>
    </section>

    <ng-container *ngIf="tipo() as t">

      <!-- ============================================== 2. Datos del acto -->
      <section class="bloque">
        <div class="bloque-titulo">
          <span class="numero">2</span>
          <div>
            <h3>Datos</h3>
            <p>{{ ayudaDelTipo() }}</p>
          </div>
        </div>

        <form [formGroup]="form" class="campos">
          <div class="campo span-3" *ngIf="t === 'ASIGNACION' || t === 'TRASPASO'">
            <label for="custodio">
              Custodio
              <span class="obligatorio" *ngIf="t === 'ASIGNACION'">obligatorio</span>
            </label>
            <p-dropdown inputId="custodio" formControlName="custodio_destino_id"
                        [options]="usuarios()" optionLabel="name" optionValue="id"
                        placeholder="Seleccione" [filter]="true" filterBy="name"
                        appendTo="body" />
            <small>Quien responde por el bien y firma su recepción.</small>
          </div>

          <div class="campo span-3" *ngIf="t === 'ASIGNACION' || t === 'TRASPASO'">
            <label for="ubicacion">Ubicación destino</label>
            <p-dropdown inputId="ubicacion" formControlName="ubicacion_destino_id"
                        [options]="ubicaciones()" optionLabel="nombre" optionValue="id"
                        placeholder="Mantener la actual" [showClear]="true"
                        [filter]="true" filterBy="nombre" appendTo="body" />
          </div>

          <div class="campo span-3" *ngIf="t === 'SALIDA_TEMPORAL'">
            <label for="destino">
              Destino <span class="obligatorio">obligatorio</span>
            </label>
            <input id="destino" pInputText formControlName="destino_externo"
                   placeholder="Domicilio del custodio, obra, comisión…" />
          </div>

          <div class="campo span-3" *ngIf="t === 'SALIDA_TEMPORAL'">
            <label for="retorno">
              Retorno comprometido <span class="obligatorio">obligatorio</span>
            </label>
            <p-calendar inputId="retorno" formControlName="fecha_retorno_comprometida"
                        dateFormat="dd/mm/yy" [showIcon]="true" [minDate]="manana"
                        appendTo="body" />
            <small>Sin plazo no hay control: el sistema avisa cuando vence.</small>
          </div>

          <div class="campo span-6">
            <label for="motivo">Motivo</label>
            <input id="motivo" pInputText formControlName="motivo"
                   placeholder="Por qué se emite este documento" />
          </div>

          <div class="campo span-6">
            <label for="obs">Observaciones</label>
            <textarea id="obs" pInputTextarea formControlName="observaciones" rows="2"></textarea>
          </div>
        </form>
      </section>

      <!-- ================================================ 3. Bienes -->
      <section class="bloque">
        <div class="bloque-titulo">
          <span class="numero">3</span>
          <div>
            <h3>Bienes incluidos</h3>
            <p>{{ ayudaDeSeleccion() }}</p>
          </div>
        </div>

        <div class="barra">
          <span class="campo-busqueda">
            <i class="pi pi-search"></i>
            <input pInputText placeholder="Código, denominación o serie…"
                   [(ngModel)]="busqueda" [ngModelOptions]="{standalone: true}"
                   (keyup.enter)="buscarActivos()" />
          </span>
          <p-button label="Buscar" icon="pi pi-search" [outlined]="true"
                    (onClick)="buscarActivos()" />
        </div>

        <p-table [value]="disponibles()" [loading]="buscando()" [paginator]="true" [rows]="8"
                 styleClass="p-datatable-sm tabla">
          <ng-template pTemplate="header">
            <tr>
              <th style="width: 3rem"></th>
              <th style="width: 13rem">Código</th>
              <th>Denominación</th>
              <th style="width: 10rem">Serie</th>
              <th style="width: 9rem" class="centro">Estado</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-a>
            <tr [class.ya-elegido]="estaElegido(a.id)">
              <td class="centro">
                <p-button [icon]="estaElegido(a.id) ? 'pi pi-check' : 'pi pi-plus'"
                          [text]="true" [rounded]="true" size="small"
                          [severity]="estaElegido(a.id) ? 'success' : 'primary'"
                          (onClick)="alternar(a)" />
              </td>
              <td><span class="codigo">{{ a.codigo }}</span></td>
              <td>{{ a.denominacion }}</td>
              <td><span class="codigo">{{ a.serie || '—' }}</span></td>
              <td class="centro"><p-tag [value]="a.estado" severity="secondary" /></td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr><td colspan="5">
              <div class="vacio">
                <i class="pi pi-search"></i>
                <p class="titulo-vacio">{{ mensajeVacio() }}</p>
              </div>
            </td></tr>
          </ng-template>
        </p-table>

        <div class="elegidos" *ngIf="elegidos().length">
          <div class="elegidos-titulo">
            {{ elegidos().length }} bien(es) en este documento
          </div>
          <div class="chips">
            <span class="chip" *ngFor="let a of elegidos()">
              {{ a.codigo }}
              <button type="button" (click)="alternar(a)"><i class="pi pi-times"></i></button>
            </span>
          </div>
        </div>
      </section>

      <div class="barra-accion">
        <div class="resumen">
          <span class="etiqueta-total">Se emitirá en borrador</span>
          <span class="total">{{ elegidos().length }} bien(es)</span>
        </div>
        <div class="botones">
          <p-button label="Cancelar" [text]="true" (onClick)="volver()" />
          <p-button label="Emitir documento" icon="pi pi-check"
                    [disabled]="!puedeEmitir() || guardando()" [loading]="guardando()"
                    (onClick)="emitir()" />
        </div>
      </div>
    </ng-container>
  `,
  styles: [ESTILOS_CONFIG, `
    :host { padding-bottom: 7rem; }

    .volver {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0; margin-bottom: 0.5rem; font-size: 0.82rem;
      color: var(--text-color-secondary, #6b7280);
      background: none; border: none; cursor: pointer;
    }

    .bloque {
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #e5e7eb);
      border-radius: 12px; padding: 1.5rem; margin-bottom: 1.25rem;
    }

    .bloque-titulo {
      display: flex; gap: 0.85rem; align-items: flex-start;
      padding-bottom: 1.25rem; margin-bottom: 1.25rem;
      border-bottom: 1px solid var(--surface-border, #f1f3f5);
    }

    .numero {
      display: grid; place-items: center; width: 1.75rem; height: 1.75rem;
      flex-shrink: 0; font-size: 0.8rem; font-weight: 650;
      color: var(--primary-color, #3b82f6); background: var(--primary-50, #eff6ff);
      border-radius: 50%;
    }

    .bloque-titulo h3 { margin: 0; font-size: 1rem; font-weight: 600; }
    .bloque-titulo p {
      margin: 0.2rem 0 0; font-size: 0.82rem; line-height: 1.4;
      color: var(--text-color-secondary, #6b7280);
    }

    .tipos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; }
    @media (max-width: 900px) { .tipos { grid-template-columns: repeat(2, 1fr); } }

    .tarjeta-tipo {
      display: flex; flex-direction: column; gap: 0.3rem; text-align: left;
      padding: 1rem; cursor: pointer;
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #e5e7eb);
      border-radius: 10px;
    }
    .tarjeta-tipo:hover { border-color: var(--primary-color, #3b82f6); }
    .tarjeta-tipo.elegida {
      border-color: var(--primary-color, #3b82f6);
      background: var(--primary-50, #eff6ff);
      box-shadow: 0 0 0 1px var(--primary-color, #3b82f6);
    }
    .tarjeta-tipo i { font-size: 1.15rem; color: var(--primary-color, #3b82f6); }
    .tarjeta-tipo .nombre { font-weight: 600; font-size: 0.9rem; }
    .tarjeta-tipo .desc {
      font-size: 0.75rem; line-height: 1.35;
      color: var(--text-color-secondary, #6b7280);
    }

    .obligatorio {
      font-size: 0.62rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; color: #b45309; background: #fef3c7;
      padding: 0.08rem 0.35rem; border-radius: 3px; margin-left: 0.4rem;
    }

    .ya-elegido { background: #f0fdf4; }

    .elegidos {
      margin-top: 1rem; padding: 0.9rem 1rem;
      background: var(--surface-ground, #f9fafb); border-radius: 8px;
    }
    .elegidos-titulo {
      font-size: 0.78rem; font-weight: 600; margin-bottom: 0.6rem;
      color: var(--text-color-secondary, #6b7280);
    }
    .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .chip {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.2rem 0.3rem 0.2rem 0.55rem;
      font-family: ui-monospace, monospace; font-size: 0.75rem; font-weight: 600;
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #e5e7eb); border-radius: 5px;
    }
    .chip button {
      display: grid; place-items: center; padding: 0.1rem;
      font-size: 0.6rem; color: var(--text-color-secondary, #9ca3af);
      background: none; border: none; cursor: pointer;
    }
    .chip button:hover { color: #dc2626; }

    .barra-accion {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 10;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.9rem 2rem;
      background: var(--surface-card, #fff);
      border-top: 1px solid var(--surface-border, #e5e7eb);
      box-shadow: 0 -2px 12px rgb(0 0 0 / 0.04);
    }
    .resumen { display: flex; flex-direction: column; }
    .etiqueta-total {
      font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--text-color-secondary, #9ca3af);
    }
    .total { font-size: 1.2rem; font-weight: 650; }
    .botones { display: flex; gap: 0.5rem; }
  `],
})
export class DocumentoFormComponent implements OnInit {
  private readonly servicio = inject(DocumentoService);
  private readonly activos = inject(ActivoService);
  private readonly catalogos = inject(CatalogoService);
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);

  readonly tipo = signal<TipoDocumento | null>(null);
  readonly disponibles = signal<ActivoLista[]>([]);
  readonly elegidos = signal<ActivoLista[]>([]);
  readonly usuarios = signal<Usuario[]>([]);
  readonly ubicaciones = signal<Ubicacion[]>([]);
  readonly buscando = signal(false);
  readonly guardando = signal(false);

  readonly tipos = TIPOS_DOCUMENTO;
  readonly manana = new Date(Date.now() + 86_400_000);

  busqueda = '';

  readonly form = this.fb.group({
    custodio_destino_id: [null as number | null],
    ubicacion_destino_id: [null as number | null],
    destino_externo: [''],
    fecha_retorno_comprometida: [null as Date | null],
    motivo: [''],
    observaciones: [''],
  });

  ngOnInit(): void {
    this.catalogos.listarUbicaciones(true).subscribe((u) => this.ubicaciones.set(u));

    // La lista de personas sale del módulo de usuarios del sistema.
    this.http.get<{ data: Usuario[] }>(`${environment.apiUrl}/usuarios`, {
      params: { por_pagina: 200, activo: true } as any,
    }).subscribe({
      next: (r) => this.usuarios.set(r.data ?? []),
      error: () => this.toast.add({
        severity: 'warn', summary: 'No se pudo cargar la lista de usuarios',
      }),
    });
  }

  elegirTipo(t: TipoDocumento): void {
    this.tipo.set(t);
    this.elegidos.set([]);
    this.disponibles.set([]);
    this.form.reset();
    this.ajustarValidadores(t);
    this.buscarActivos();
  }

  /** Cada tipo exige campos distintos. */
  private ajustarValidadores(t: TipoDocumento): void {
    const custodio = this.form.get('custodio_destino_id');
    const destino = this.form.get('destino_externo');
    const retorno = this.form.get('fecha_retorno_comprometida');

    [custodio, destino, retorno].forEach((c) => c?.clearValidators());

    if (t === 'ASIGNACION') {
      custodio?.addValidators(Validators.required);
    }

    if (t === 'SALIDA_TEMPORAL') {
      destino?.addValidators(Validators.required);
      retorno?.addValidators(Validators.required);
    }

    [custodio, destino, retorno].forEach((c) => c?.updateValueAndValidity());
  }

  ayudaDelTipo(): string {
    return this.tipos.find((t) => t.valor === this.tipo())?.descripcion ?? '';
  }

  /**
   * El filtro de bienes depende del tipo: no tiene sentido ofrecer bienes
   * asignados para una asignación, ni bienes libres para un traspaso.
   */
  ayudaDeSeleccion(): string {
    const ayudas: Record<string, string> = {
      ASIGNACION: 'Solo bienes sin custodio. Los que ya tienen responsable se traspasan.',
      TRASPASO: 'Solo bienes ya asignados a alguien.',
      SALIDA_TEMPORAL: 'Solo bienes en uso.',
      DEVOLUCION: 'Bienes a cargo de un custodio que los devuelve.',
    };

    return ayudas[this.tipo() ?? ''] ?? '';
  }

  mensajeVacio(): string {
    return this.busqueda
      ? 'Ningún bien coincide con la búsqueda'
      : 'No hay bienes disponibles para este tipo de documento';
  }

  buscarActivos(): void {
    const t = this.tipo();
    if (!t) return;

    this.buscando.set(true);

    const filtros: any = { buscar: this.busqueda, por_pagina: 50 };

    // El estado se usa como aproximación del filtro correcto; el backend
    // vuelve a validar activo por activo al emitir.
    if (t === 'ASIGNACION') filtros.estado = 'REGISTRADO';
    if (t === 'SALIDA_TEMPORAL') filtros.estado = 'EN_USO';
    if (t === 'TRASPASO' || t === 'DEVOLUCION') filtros.estado = 'EN_USO';

    this.activos.listar(filtros).subscribe({
      next: (r) => { this.disponibles.set(r.data); this.buscando.set(false); },
      error: () => this.buscando.set(false),
    });
  }

  estaElegido(id: number): boolean {
    return this.elegidos().some((a) => a.id === id);
  }

  alternar(a: ActivoLista): void {
    this.elegidos.update((lista) =>
      lista.some((x) => x.id === a.id)
        ? lista.filter((x) => x.id !== a.id)
        : [...lista, a]
    );
  }

  puedeEmitir(): boolean {
    return this.form.valid && this.elegidos().length > 0;
  }

  emitir(): void {
    const t = this.tipo();
    if (!t) return;

    this.guardando.set(true);

    const v = this.form.getRawValue();

    const payload = {
      tipo: t,
      activos: this.elegidos().map((a) => a.id),
      custodio_destino_id: v.custodio_destino_id,
      ubicacion_destino_id: v.ubicacion_destino_id,
      destino_externo: v.destino_externo || null,
      fecha_retorno_comprometida: this.aFecha(v.fecha_retorno_comprometida),
      motivo: v.motivo || null,
      observaciones: v.observaciones || null,
    };

    this.servicio.emitir(payload).subscribe({
      next: (doc) => {
        this.guardando.set(false);
        this.toast.add({
          severity: 'success',
          summary: 'Documento emitido en borrador',
          detail: `${doc.numero} · todavía no afecta a los bienes`,
          life: 6000,
        });
        this.router.navigate(['/activos/custodia', doc.id]);
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'No se pudo emitir',
          detail: e?.error?.mensaje ?? this.primerError(e) ?? 'Revise los datos.',
          life: 8000,
        });
      },
    });
  }

  private primerError(e: any): string | null {
    const errores = e?.error?.errors;
    if (!errores) return null;
    return (Object.values(errores)[0] as string[])?.[0] ?? null;
  }

  private aFecha(v: Date | null): string | null {
    if (!v) return null;
    const d = new Date(v);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  volver(): void {
    this.router.navigate(['/activos/custodia']);
  }
}
