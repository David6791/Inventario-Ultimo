import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { Bocamina, DatosPesaje, DatosRecepcion, Mina, Opciones, Productor, SerieLote } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';
import { RecepcionService } from '../core/services/recepcion.service';
import { SeriesService } from '../core/services/series.service';
import { PesajeCamposComponent, grupoPesaje, recordarBascula } from './pesaje-campos.component';

/**
 * Recepción de un lote. La serie decide el origen: de compra pide productor;
 * de producción propia, mina propia y bocamina. El código lo genera la base al
 * guardar (se muestra el próximo que saldrá). El primer pesaje va en el mismo
 * paso si el camión ya pasó por la báscula.
 */
@Component({
  selector: 'app-recibir-lote',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, AutoCompleteModule, ButtonModule, CheckboxModule,
            DropdownModule, InputTextModule, InputTextareaModule, ToastModule, PesajeCamposComponent],
  providers: [MessageService],
  template: `
    <p-toast />
    <a routerLink="/cargas/lotes" class="volver"><i class="pi pi-arrow-left"></i> Lotes</a>

    <header class="encabezado">
      <div>
        <h2>Recibir lote</h2>
        <p class="subtitulo">Registre el mineral que llega. El código del lote sale solo; la cooperativa y el
          municipio se toman del productor y de la mina.</p>
      </div>
    </header>

    <form [formGroup]="form" class="tarjeta">
      <h3>Lote</h3>
      <div class="campos">
        <div class="campo span-3">
          <label for="serie">Serie</label>
          <p-dropdown inputId="serie" formControlName="serie_id" [options]="series()" optionLabel="nombre" optionValue="id"
                      placeholder="Elija la serie" [filter]="true" filterBy="nombre,prefijo" appendTo="body" [style]="{ width: '100%' }">
            <ng-template let-s pTemplate="item">
              <div class="opcion-serie"><span class="codigo">{{ s.prefijo }}</span> {{ s.nombre }}
                <span class="pastilla" [class.pastilla-acento]="s.origen === 'PROPIA'">{{ s.origen === 'PROPIA' ? 'Propia' : 'Compra' }}</span></div>
            </ng-template>
          </p-dropdown>
        </div>
        <div class="campo span-3">
          <label>Código que se asignará</label>
          <div class="proximo">{{ serie()?.proximo_codigo ?? '—' }}</div>
          <small *ngIf="serie()">{{ serie()!.linea?.nombre }}</small>
        </div>

        <div class="campo span-3">
          <label for="sede">Sede</label>
          <p-dropdown inputId="sede" formControlName="almacen_id" [options]="opciones()?.almacenes ?? []" optionLabel="nombre"
                      optionValue="id" placeholder="Elija la sede" appendTo="body" [style]="{ width: '100%' }" />
        </div>
        <div class="campo span-3">
          <label for="guia">Guía de transporte <span class="opcional">(opcional)</span></label>
          <input id="guia" pInputText formControlName="guia_transporte" maxlength="40" class="codigo" />
        </div>

        <ng-container *ngIf="serie()?.origen === 'COMPRA'">
          <div class="campo span-3">
            <label for="productor">Productor</label>
            <p-autoComplete inputId="productor" [(ngModel)]="productorTexto" [ngModelOptions]="{ standalone: true }"
                            [suggestions]="productores()" (completeMethod)="buscarProductor($event.query)" (onSelect)="elegirProductor($event.value)"
                            (onClear)="elegirProductor(null)" field="nombre" [minLength]="2" [delay]="250" [forceSelection]="true"
                            placeholder="Nombre, CI o NIT" appendTo="body" [style]="{ width: '100%' }" [inputStyle]="{ width: '100%' }">
              <ng-template let-p pTemplate="item">
                <div class="sugerencia"><span>{{ p.nombre }}</span>
                  <span class="secundario">{{ p.ci ? 'CI ' + p.ci : p.nit ? 'NIT ' + p.nit : '' }} {{ p.cooperativa?.nombre ? '· ' + p.cooperativa.nombre : '' }}</span></div>
              </ng-template>
            </p-autoComplete>
            <small *ngIf="productor() as p">{{ p.cooperativa?.nombre ?? 'Sin cooperativa' }}</small>
          </div>
          <div class="campo span-3">
            <label for="mina">Mina <span class="opcional">(opcional)</span></label>
            <p-dropdown inputId="mina" formControlName="mina_id" [options]="minasCompra()" optionLabel="nombre" optionValue="id"
                        placeholder="De dónde viene el mineral" [filter]="true" filterBy="nombre" [showClear]="true" appendTo="body" [style]="{ width: '100%' }" />
            <small>Define el municipio para la regalía.</small>
          </div>
        </ng-container>

        <ng-container *ngIf="serie()?.origen === 'PROPIA'">
          <div class="campo span-3">
            <label for="mina-propia">Mina propia</label>
            <p-dropdown inputId="mina-propia" formControlName="mina_id" [options]="minasPropias()" optionLabel="nombre" optionValue="id"
                        placeholder="Elija la mina" appendTo="body" (onChange)="cargarBocaminas()" />
          </div>
          <div class="campo span-3">
            <label for="bocamina">Bocamina</label>
            <p-dropdown inputId="bocamina" formControlName="bocamina_id" [options]="bocaminas()" optionValue="id"
                        [optionLabel]="'codigo'" placeholder="Elija la bocamina" appendTo="body" [style]="{ width: '100%' }" />
          </div>
        </ng-container>

        <div class="campo span-6">
          <label for="obs">Observaciones <span class="opcional">(opcional)</span></label>
          <textarea id="obs" pInputTextarea formControlName="observaciones" rows="2" maxlength="1000"></textarea>
        </div>
      </div>
    </form>

    <section class="tarjeta">
      <div class="titulo-pesaje">
        <h3>Pesaje de ingreso</h3>
        <span class="check"><p-checkbox [(ngModel)]="conPesaje" [binary]="true" inputId="con-pesaje" />
          <label for="con-pesaje">El camión ya pasó por la báscula</label></span>
      </div>
      <app-pesaje-campos *ngIf="conPesaje" [grupo]="pesaje" />
      <p class="secundario" *ngIf="!conPesaje">Podrá agregar los pesajes después, desde la ficha del lote.</p>
    </section>

    <div class="pie">
      <p-button label="Cancelar" [text]="true" routerLink="/cargas/lotes" />
      <p-button label="Recibir lote" icon="pi pi-check" [loading]="guardando()" [disabled]="!listo() || guardando()" (onClick)="guardar()" />
    </div>
  `,
  styles: [ESTILOS_CARGAS, `
    .volver { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; margin-bottom: 0.6rem;
              color: var(--text-color-secondary, #6b7280); text-decoration: none; }
    .tarjeta { border: 1px solid var(--surface-border, #e5e7eb); border-radius: 10px; padding: 1rem 1.2rem;
               background: var(--surface-card, #fff); margin-bottom: 1rem; max-width: 60rem; }
    .tarjeta h3 { margin: 0 0 0.8rem; font-size: 1rem; }
    .proximo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 1.3rem; font-weight: 700; padding: 0.3rem 0; }
    .opcional { font-weight: 400; color: var(--text-color-secondary, #9ca3af); }
    .titulo-pesaje { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; }
    .titulo-pesaje h3 { margin: 0; }
    .check { display: flex; align-items: center; gap: 0.4rem; font-size: 0.88rem; }
    .pie { display: flex; justify-content: flex-end; gap: 0.5rem; max-width: 60rem; }
    .sugerencia { display: flex; flex-direction: column; }
    .opcion-serie { display: flex; gap: 0.5rem; align-items: center; }
  `],
})
export class RecibirLoteComponent implements OnInit {
  private readonly catalogos = inject(CatalogosCargasService);
  private readonly seriesSrv = inject(SeriesService);
  private readonly servicio = inject(RecepcionService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly router = inject(Router);

  readonly series = signal<SerieLote[]>([]);
  readonly minas = signal<Mina[]>([]);
  readonly bocaminas = signal<Bocamina[]>([]);
  readonly productores = signal<Productor[]>([]);
  readonly productor = signal<Productor | null>(null);
  readonly opciones = signal<Opciones | null>(null);
  readonly serieId = signal<number | null>(null);
  readonly guardando = signal(false);

  productorTexto: string | Productor | null = null;
  conPesaje = true;

  readonly form = this.fb.group({
    serie_id: [null as number | null, Validators.required],
    almacen_id: [null as number | null, Validators.required],
    mina_id: [null as number | null],
    bocamina_id: [null as number | null],
    guia_transporte: [null as string | null],
    observaciones: [null as string | null],
  });
  readonly pesaje = grupoPesaje(this.fb);

  readonly serie = computed(() => this.series().find((s) => s.id === this.serieId()) ?? null);
  readonly minasCompra = computed(() => this.minas().filter((m) => !m.propia));
  readonly minasPropias = computed(() => this.minas().filter((m) => m.propia));

  ngOnInit(): void {
    this.seriesSrv.listar().subscribe((r) => this.series.set(r.data.filter((s) => s.activa)));
    this.catalogos.listarMinas({ solo_activas: true }).subscribe((m) => this.minas.set(m));
    this.catalogos.opciones$.subscribe((o) => {
      this.opciones.set(o);
      const sede = o.almacen_predeterminado ?? (o.almacenes.length === 1 ? o.almacenes[0].id : null);
      if (sede && !this.form.value.almacen_id) this.form.patchValue({ almacen_id: sede });
    });
    this.form.get('serie_id')!.valueChanges.subscribe((id) => {
      this.serieId.set(id);
      this.form.patchValue({ mina_id: null, bocamina_id: null }, { emitEvent: false });
      this.bocaminas.set([]);
    });
  }

  buscarProductor(texto: string): void {
    this.catalogos.listarProductores({ buscar: texto }).subscribe((r) => this.productores.set(r.data.filter((p) => p.activo)));
  }

  elegirProductor(p: Productor | null): void {
    this.productor.set(p);
  }

  cargarBocaminas(): void {
    const mina = this.form.value.mina_id;
    this.form.patchValue({ bocamina_id: null });
    if (mina) this.catalogos.listarBocaminas(mina).subscribe((b) => this.bocaminas.set(b.filter((x) => x.activa)));
  }

  listo(): boolean {
    const s = this.serie();
    if (!s || this.form.invalid) return false;
    if (s.origen === 'COMPRA' && !this.productor()) return false;
    if (s.origen === 'PROPIA' && (!this.form.value.mina_id || !this.form.value.bocamina_id)) return false;
    if (this.conPesaje && this.pesaje.invalid) return false;
    return true;
  }

  guardar(): void {
    const v = this.form.getRawValue();
    const datos: DatosRecepcion = {
      serie_id: v.serie_id!, almacen_id: v.almacen_id!,
      productor_id: this.serie()?.origen === 'COMPRA' ? this.productor()?.id ?? null : null,
      mina_id: v.mina_id, bocamina_id: v.bocamina_id, guia_transporte: v.guia_transporte, observaciones: v.observaciones,
      pesaje: this.conPesaje ? (this.pesaje.getRawValue() as DatosPesaje) : null,
    };

    this.guardando.set(true);
    this.servicio.recibir(datos).subscribe({
      next: (r) => {
        recordarBascula(datos.pesaje?.bascula);
        this.router.navigate(['/cargas/lotes', r.data.id], { state: { mensaje: r.mensaje } });
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se recibió el lote', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }
}
