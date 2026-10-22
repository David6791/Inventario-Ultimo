import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SliderModule } from 'primeng/slider';
import { ToastModule } from 'primeng/toast';
import { mensajeDeError } from '../../cargas/core/errores';
import { EmpresaService } from '../../core/services/empresa.service';

/**
 * Nombre, línea de detalle, logo y marca de agua que salen en todos los
 * documentos y reportes, en la pantalla de ingreso y en el menú.
 */
@Component({
  selector: 'app-empresa',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, SliderModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <header class="pagina">
      <div>
        <h1>Datos de la empresa</h1>
        <p>Lo que sale en el encabezado de comprobantes, boletas, rótulos y reportes, en la pantalla de ingreso y en el menú.
           Los documentos que se impriman desde ahora salen con estos datos.</p>
      </div>
    </header>

    <div class="disposicion">
      <section class="formulario">
        <div class="campo">
          <label for="nombre">Nombre de la empresa</label>
          <input id="nombre" pInputText [(ngModel)]="nombre" maxlength="120" />
        </div>
        <div class="campo">
          <label for="subtitulo">Línea de detalle <span class="opcional">(opcional)</span></label>
          <input id="subtitulo" pInputText [(ngModel)]="subtitulo" maxlength="200" placeholder="NIT · dirección · teléfono" />
          <span class="ayuda">Sale en letra pequeña debajo del nombre.</span>
        </div>

        <div class="imagen">
          <div class="cabeza-imagen">
            <div>
              <label>Logo</label>
              <span class="ayuda">PNG o JPG, hasta 1 MB. Mejor con fondo transparente y más ancho que alto.</span>
            </div>
            <div class="botones">
              <label class="p-button p-button-outlined p-button-sm subir">
                <i class="pi pi-upload"></i>&nbsp;Elegir
                <input type="file" accept="image/png,image/jpeg" (change)="elegir($event, 'logo')" hidden />
              </label>
              <p-button *ngIf="logoVista()" icon="pi pi-trash" [text]="true" severity="danger" size="small"
                        (onClick)="quitar('logo')" ariaLabel="Quitar el logo" />
            </div>
          </div>
          <div class="muestra" *ngIf="logoVista() as v"><img [src]="v" alt="Logo" /></div>
        </div>

        <div class="imagen">
          <div class="cabeza-imagen">
            <div>
              <label>Marca de agua</label>
              <span class="ayuda">Imagen grande y simple (el escudo o el logo). Se imprime tenue en el centro de cada hoja.</span>
            </div>
            <div class="botones">
              <label class="p-button p-button-outlined p-button-sm subir">
                <i class="pi pi-upload"></i>&nbsp;Elegir
                <input type="file" accept="image/png,image/jpeg" (change)="elegir($event, 'marca')" hidden />
              </label>
              <p-button *ngIf="marcaVista()" icon="pi pi-trash" [text]="true" severity="danger" size="small"
                        (onClick)="quitar('marca')" ariaLabel="Quitar la marca de agua" />
            </div>
          </div>
          <div class="campo" *ngIf="marcaVista()">
            <label>Intensidad: {{ opacidad }} %</label>
            <p-slider [(ngModel)]="opacidad" [min]="2" [max]="30" />
          </div>
        </div>

        <div class="acciones-form">
          <p-button label="Guardar" icon="pi pi-check" [loading]="guardando()" [disabled]="!nombre.trim() || guardando()"
                    (onClick)="guardar()" />
        </div>
      </section>

      <section class="vista">
        <span class="rotulo">Así sale en un documento</span>
        <div class="hoja">
          <img *ngIf="marcaVista() as m" class="marca-agua" [src]="m" alt="" [style.opacity]="opacidad / 100" />
          <div class="hoja-cabeza">
            <div>
              <div class="hoja-nombre"><img *ngIf="logoVista() as l" [src]="l" alt="" />{{ nombre || 'Nombre de la empresa' }}</div>
              <div class="hoja-detalle" *ngIf="subtitulo">{{ subtitulo }}</div>
            </div>
            <div class="hoja-titulo">COMPROBANTE DE EGRESO<br /><span>N.º CP-001530</span></div>
          </div>
          <div class="renglon" *ngFor="let r of renglones"><span>{{ r[0] }}</span><span>{{ r[1] }}</span></div>
          <div class="firmas"><span>Entregué conforme</span><span>Recibí conforme</span></div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .disposicion { display:grid; grid-template-columns:minmax(0, 26rem) minmax(0, 1fr); gap:2rem; align-items:start; }
    .formulario { display:flex; flex-direction:column; gap:1.1rem; }
    .opcional { font-weight:400; color:var(--tinta-tenue); }
    .imagen { border:1px solid var(--linea); border-radius:10px; padding:.9rem 1rem; background:var(--superficie);
              display:flex; flex-direction:column; gap:.75rem; }
    .cabeza-imagen { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; }
    .cabeza-imagen label { font-size:var(--t-sm); font-weight:500; display:block; }
    .cabeza-imagen .ayuda { font-size:var(--t-xs); color:var(--tinta-suave); }
    .botones { display:flex; align-items:center; gap:.25rem; flex:none; }
    .subir { cursor:pointer; }
    .muestra { background:repeating-conic-gradient(#f1f4f5 0% 25%, #fff 0% 50%) 50% / 16px 16px; border-radius:6px;
               padding:.75rem; display:grid; place-items:center; }
    .muestra img { max-height:5rem; max-width:100%; }
    .acciones-form { display:flex; justify-content:flex-end; }

    .vista { position:sticky; top:5rem; }
    .rotulo { font-size:var(--t-xs); text-transform:uppercase; letter-spacing:.05em; color:var(--tinta-suave); }
    .hoja { position:relative; overflow:hidden; margin-top:.5rem; background:#fff; border:1px solid var(--linea);
            border-radius:4px; box-shadow:0 8px 24px rgba(22,50,63,.08); padding:1.6rem 1.8rem; aspect-ratio: 8.5 / 7;
            font-family:'DejaVu Sans', var(--fuente); color:#111; }
    .marca-agua { position:absolute; left:20%; width:60%; top:22%; pointer-events:none; }
    .hoja-cabeza { position:relative; display:flex; justify-content:space-between; gap:1rem; border-bottom:2px solid #111;
                   padding-bottom:.6rem; margin-bottom:.9rem; }
    .hoja-nombre { font-weight:700; font-size:.8rem; text-transform:uppercase; letter-spacing:.04em; display:flex; align-items:center; gap:.5rem; }
    .hoja-nombre img { height:2rem; }
    .hoja-detalle { font-size:.62rem; color:#444; margin-top:.15rem; }
    .hoja-titulo { text-align:right; font-weight:700; font-size:.75rem; letter-spacing:.06em; }
    .hoja-titulo span { font-family:var(--fuente-codigo); font-size:.8rem; }
    .renglon { position:relative; display:flex; gap:1rem; font-size:.7rem; padding:.35rem 0; border-bottom:1px dotted #bbb; }
    .renglon span:first-child { width:6rem; color:#555; text-transform:uppercase; font-size:.6rem; }
    .firmas { position:absolute; bottom:1.4rem; left:1.8rem; right:1.8rem; display:flex; justify-content:space-around;
              font-size:.6rem; color:#444; }
    .firmas span { border-top:1px solid #111; padding-top:.2rem; width:38%; text-align:center; }

    @media (max-width: 60rem) {
      .disposicion { grid-template-columns:1fr; }
      .vista { position:static; }
    }
  `],
})
export class EmpresaComponent implements OnInit, OnDestroy {
  private readonly servicio = inject(EmpresaService);
  private readonly toast = inject(MessageService);

  nombre = '';
  subtitulo = '';
  opacidad = 8;
  readonly guardando = signal(false);
  readonly logoVista = signal<string | null>(null);
  readonly marcaVista = signal<string | null>(null);

  private logo: File | null = null;
  private marca: File | null = null;
  private quitarLogo = false;
  private quitarMarca = false;
  private urls: string[] = [];

  readonly renglones = [
    ['Fecha', '22/10/2026 11:54'], ['Pagado a', 'Juan Pérez · CI 4455667'],
    ['Concepto', 'Compra de combustible'], ['Glosa', 'Viaje de muestreo a Porco'],
  ];

  ngOnInit(): void {
    this.servicio.refrescar().subscribe({
      next: (d) => {
        this.nombre = d.nombre;
        this.subtitulo = d.subtitulo ?? '';
        this.opacidad = Math.round(d.marca_agua_opacidad * 100);
        this.logoVista.set(this.servicio.logoUrl());
        if (d.tiene_marca) {
          this.servicio.marcaAgua().subscribe((b) => this.marcaVista.set(this.url(b)));
        }
      },
    });
  }

  ngOnDestroy(): void {
    this.urls.forEach((u) => URL.revokeObjectURL(u));
  }

  elegir(evento: Event, cual: 'logo' | 'marca'): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    const limite = cual === 'logo' ? 1 : 2;
    if (archivo.size > limite * 1024 * 1024) {
      this.toast.add({ severity: 'warn', summary: `La imagen pesa más de ${limite} MB`, detail: 'Redúzcala e intente de nuevo.' });
      return;
    }
    if (cual === 'logo') { this.logo = archivo; this.quitarLogo = false; this.logoVista.set(this.url(archivo)); }
    else { this.marca = archivo; this.quitarMarca = false; this.marcaVista.set(this.url(archivo)); }
  }

  quitar(cual: 'logo' | 'marca'): void {
    if (cual === 'logo') { this.logo = null; this.quitarLogo = true; this.logoVista.set(null); }
    else { this.marca = null; this.quitarMarca = true; this.marcaVista.set(null); }
  }

  guardar(): void {
    const datos = new FormData();
    datos.append('nombre', this.nombre.trim());
    datos.append('subtitulo', this.subtitulo.trim());
    datos.append('marca_agua_opacidad', String(this.opacidad / 100));
    if (this.logo) datos.append('logo', this.logo);
    if (this.marca) datos.append('marca_agua', this.marca);
    if (this.quitarLogo) datos.append('quitar_logo', '1');
    if (this.quitarMarca) datos.append('quitar_marca_agua', '1');

    this.guardando.set(true);
    this.servicio.guardar(datos).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.logo = this.marca = null;
        this.quitarLogo = this.quitarMarca = false;
        this.toast.add({ severity: 'success', summary: r.mensaje, life: 6000 });
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se guardó', detail: mensajeDeError(e), life: 9000 });
      },
    });
  }

  private url(b: Blob): string {
    const u = URL.createObjectURL(b);
    this.urls.push(u);
    return u;
  }
}
