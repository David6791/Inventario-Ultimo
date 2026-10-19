import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { PermisosService } from '../../core/services/permisos.service';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { Cotizacion, Elemento } from '../core/models/cargas.model';
import { aNumero, aTexto, formatoLey, numeroInvalido } from '../core/numeros';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';
import { PreciosService } from '../core/services/precios.service';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Cotizaciones quincenales: oficiales (con alícuotas de regalía) y de referencia para tablas por porcentaje. */
@Component({
  selector: 'app-cotizaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, DropdownModule, InputTextModule, SelectButtonModule, TableModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <header class="encabezado">
      <div>
        <h2>Cotizaciones</h2>
        <p class="subtitulo">Una por elemento y quincena. La oficial es la publicada por el Ministerio de Minería, con las alícuotas de regalía;
          la de referencia, la que usa la empresa en sus tablas por porcentaje.</p>
      </div>
      <div class="acciones" *ngIf="puede()"><p-button label="Nueva cotización" icon="pi pi-plus" (onClick)="nueva()" /></div>
    </header>

    <div class="barra">
      <p-dropdown class="filtro" [options]="elementos()" [(ngModel)]="filtro.elemento_id" optionLabel="codigo" optionValue="id"
                  placeholder="Todos los elementos" [showClear]="true" (onChange)="cargar()" />
      <p-dropdown class="filtro" [options]="anios" [(ngModel)]="filtro.anio" placeholder="Todos los años" [showClear]="true" (onChange)="cargar()" />
    </div>

    <p-table [value]="lista()" [loading]="cargando()" dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr><th style="width: 15rem">Quincena</th><th style="width: 8rem">Elemento</th><th style="width: 8rem">Tipo</th>
            <th class="derecha" style="width: 10rem">Valor</th><th class="derecha" style="width: 10rem">RM exportación</th>
            <th class="derecha" style="width: 10rem">RM venta interna</th><th>Fuente</th><th style="width: 6rem"></th></tr>
      </ng-template>
      <ng-template pTemplate="body" let-c>
        <tr>
          <td>{{ c.quincena }}ª de {{ mes(c.mes) }} {{ c.anio }}<div class="secundario">{{ c.periodo_desde | date: 'dd/MM' }} al {{ c.periodo_hasta | date: 'dd/MM' }}</div></td>
          <td><b>{{ c.elemento?.codigo }}</b></td>
          <td><span class="pastilla" [class.pastilla-acento]="c.tipo === 'OFICIAL'">{{ c.tipo === 'OFICIAL' ? 'Oficial' : 'Referencia' }}</span></td>
          <td class="derecha monto">{{ ley(c.valor) }} <span class="secundario">US$/{{ c.unidad }}</span></td>
          <td class="derecha monto">{{ c.alicuota_rm_exportacion !== null ? ley(c.alicuota_rm_exportacion) + ' %' : '—' }}</td>
          <td class="derecha monto">{{ c.alicuota_rm_venta_interna !== null ? ley(c.alicuota_rm_venta_interna) + ' %' : '—' }}</td>
          <td class="secundario">{{ c.fuente }}</td>
          <td><p-button *ngIf="puede()" icon="pi pi-pencil" [text]="true" [rounded]="true" size="small" (onClick)="editar(c)" /></td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="8"><div class="vacio"><i class="pi pi-chart-line"></i><div class="titulo-vacio">Sin cotizaciones cargadas</div></div></td></tr>
      </ng-template>
    </p-table>

    <p-dialog [(visible)]="visible" [header]="editando ? 'Corregir cotización' : 'Nueva cotización'" [modal]="true" [style]="{ width: '40rem' }" [draggable]="false">
      <div class="campos">
        <div class="campo span-2"><label>Elemento</label>
          <p-dropdown [options]="elementos()" [(ngModel)]="f.elemento_id" optionLabel="codigo" optionValue="id" appendTo="body" (onChange)="unidadPorDefecto()" /></div>
        <div class="campo span-4"><label>Tipo</label>
          <p-selectButton [options]="tipos" [(ngModel)]="f.tipo" optionLabel="etiqueta" optionValue="valor" /></div>
        <div class="campo span-2"><label>Año</label><input pInputText type="number" [(ngModel)]="f.anio" min="2000" max="2100" /></div>
        <div class="campo span-2"><label>Mes</label>
          <p-dropdown [options]="meses" [(ngModel)]="f.mes" optionLabel="etiqueta" optionValue="valor" appendTo="body" /></div>
        <div class="campo span-2"><label>Quincena</label>
          <p-selectButton [options]="quincenas" [(ngModel)]="f.quincena" optionLabel="etiqueta" optionValue="valor" /></div>
        <div class="campo span-3"><label>Valor (US$)</label>
          <input pInputText inputmode="decimal" [(ngModel)]="f.valor" [class.ng-invalid]="mal(f.valor)" [class.ng-dirty]="mal(f.valor)" /></div>
        <div class="campo span-3"><label>Por</label>
          <p-dropdown [options]="unidades" [(ngModel)]="f.unidad" optionLabel="etiqueta" optionValue="valor" appendTo="body" /></div>
        <ng-container *ngIf="f.tipo === 'OFICIAL'">
          <div class="campo span-3"><label>Alícuota RM exportación (%)</label>
            <input pInputText inputmode="decimal" [(ngModel)]="f.rm_exp" [class.ng-invalid]="mal(f.rm_exp)" [class.ng-dirty]="mal(f.rm_exp)" /></div>
          <div class="campo span-3"><label>Alícuota RM venta interna (%)</label>
            <input pInputText inputmode="decimal" [(ngModel)]="f.rm_int" [class.ng-invalid]="mal(f.rm_int)" [class.ng-dirty]="mal(f.rm_int)" /></div>
        </ng-container>
        <div class="campo span-4"><label>Fuente</label><input pInputText [(ngModel)]="f.fuente" maxlength="150" placeholder="Resolución, boletín…" /></div>
        <div class="campo span-2"><label>Publicada el</label><input pInputText type="date" [(ngModel)]="f.fecha_publicacion" /></div>
      </div>
      <p class="secundario" *ngIf="editando">Si se corrige, el valor anterior queda registrado.</p>
      <ng-template pTemplate="footer">
        <p-button *ngIf="editando" label="Eliminar" severity="danger" [text]="true" icon="pi pi-trash" (onClick)="eliminar()" />
        <p-button label="Cancelar" [text]="true" (onClick)="visible = false" />
        <p-button label="Guardar" icon="pi pi-check" [loading]="guardando()" [disabled]="!valido()" (onClick)="guardar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS, `.monto { font-family: ui-monospace, 'SF Mono', Menlo, monospace; white-space: nowrap; }`],
})
export class CotizacionesComponent implements OnInit {
  private readonly servicio = inject(PreciosService);
  private readonly catalogos = inject(CatalogosCargasService);
  private readonly permisos = inject(PermisosService);
  private readonly toast = inject(MessageService);

  readonly lista = signal<Cotizacion[]>([]);
  readonly elementos = signal<Elemento[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly anios = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + 1 - i);
  readonly meses = MESES.map((m, i) => ({ valor: i + 1, etiqueta: m }));
  readonly quincenas = [{ valor: 1, etiqueta: '1ª (1–15)' }, { valor: 2, etiqueta: '2ª (16–fin)' }];
  readonly tipos = [{ valor: 'OFICIAL', etiqueta: 'Oficial' }, { valor: 'REFERENCIA', etiqueta: 'Referencia' }];
  readonly unidades = [{ valor: 'OT', etiqueta: 'onza troy' }, { valor: 'LF', etiqueta: 'libra fina' },
                       { valor: 'TMF', etiqueta: 'tonelada métrica fina' }, { valor: 'TM', etiqueta: 'tonelada métrica' }];

  filtro: { elemento_id: number | null; anio: number | null } = { elemento_id: null, anio: null };
  visible = false;
  editando: Cotizacion | null = null;
  f = this.vacio();

  ngOnInit(): void {
    this.catalogos.listarElementos().subscribe((e) => this.elementos.set(e.filter((x) => x.unidad_cotizacion)));
    this.cargar();
  }

  cargar(): void {
    this.servicio.cotizaciones(this.filtro).subscribe({
      next: (c) => { this.lista.set(c); this.cargando.set(false); },
      error: (e) => { this.cargando.set(false); this.error('No se pudo cargar', e); },
    });
  }

  puede(): boolean { return this.permisos.can('cargas.cotizaciones'); }
  mes(m: number): string { return MESES[m - 1]; }
  ley(v: string): string { return formatoLey(v); }
  mal(v: string): boolean { return numeroInvalido(v); }

  private vacio() {
    const h = new Date();
    return { elemento_id: null as number | null, tipo: 'OFICIAL' as 'OFICIAL' | 'REFERENCIA', anio: h.getFullYear(), mes: h.getMonth() + 1,
             quincena: (h.getDate() <= 15 ? 1 : 2) as 1 | 2, valor: '', unidad: 'OT', rm_exp: '', rm_int: '', fuente: '', fecha_publicacion: '' };
  }

  unidadPorDefecto(): void {
    const e = this.elementos().find((x) => x.id === this.f.elemento_id);
    if (e?.unidad_cotizacion) this.f.unidad = e.unidad_cotizacion;
  }

  nueva(): void { this.editando = null; this.f = this.vacio(); this.visible = true; }
  editar(c: Cotizacion): void {
    this.editando = c;
    this.f = { elemento_id: c.elemento_id, tipo: c.tipo, anio: c.anio, mes: c.mes, quincena: c.quincena, valor: aTexto(c.valor), unidad: c.unidad,
               rm_exp: aTexto(c.alicuota_rm_exportacion), rm_int: aTexto(c.alicuota_rm_venta_interna), fuente: c.fuente ?? '',
               fecha_publicacion: c.fecha_publicacion ?? '' };
    this.visible = true;
  }

  valido(): boolean {
    return !!this.f.elemento_id && !!this.f.anio && aNumero(this.f.valor) !== null && !this.mal(this.f.rm_exp) && !this.mal(this.f.rm_int);
  }

  guardar(): void {
    const f = this.f;
    const datos = { elemento_id: f.elemento_id!, tipo: f.tipo, anio: +f.anio, mes: f.mes, quincena: f.quincena,
                    valor: String(aNumero(f.valor)), unidad: f.unidad,
                    alicuota_rm_exportacion: f.tipo === 'OFICIAL' && aNumero(f.rm_exp) !== null ? String(aNumero(f.rm_exp)) : null,
                    alicuota_rm_venta_interna: f.tipo === 'OFICIAL' && aNumero(f.rm_int) !== null ? String(aNumero(f.rm_int)) : null,
                    fuente: f.fuente || null, fecha_publicacion: f.fecha_publicacion || null };
    this.guardando.set(true);
    this.servicio.guardarCotizacion(datos, this.editando?.id).subscribe({
      next: (r) => { this.guardando.set(false); this.visible = false; this.toast.add({ severity: 'success', summary: r.mensaje }); this.cargar(); },
      error: (e) => { this.guardando.set(false); this.error('No se guardó', e); },
    });
  }

  eliminar(): void {
    if (!this.editando) return;
    this.servicio.eliminarCotizacion(this.editando.id).subscribe({
      next: (r) => { this.visible = false; this.toast.add({ severity: 'success', summary: r.mensaje }); this.cargar(); },
      error: (e) => this.error('No se eliminó', e),
    });
  }

  private error(t: string, e: unknown): void { this.toast.add({ severity: 'error', summary: t, detail: mensajeDeError(e), life: 10000 }); }
}
