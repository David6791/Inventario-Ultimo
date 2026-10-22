import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../core/services/auth.service';
import { EmpresaService } from '../../core/services/empresa.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, PasswordModule, MessageModule],
  template: `
    <main class="pantalla">
      <form [formGroup]="formulario" (ngSubmit)="ingresar()" class="tarjeta">
        <div class="marca">
          @if (empresa.logoUrl(); as logo) {
            <img [src]="logo" alt="Logo" />
          } @else {
            <span class="marca-icono"><i class="pi pi-box"></i></span>
          }
        </div>
        <div class="titulos">
          <h1>{{ empresa.nombre() || 'Sistema de gestión' }}</h1>
          <p class="bajada">Ingrese con las credenciales que le entregó el administrador.</p>
        </div>

        @if (error()) {
          <p-message severity="error" [text]="error()!" styleClass="ancho-total" />
        }

        <div class="campo">
          <label for="email">Correo electrónico</label>
          <input pInputText id="email" type="email" formControlName="email" autocomplete="username" />
        </div>

        <div class="campo">
          <label for="password">Contraseña</label>
          <p-password inputId="password" formControlName="password" [feedback]="false"
                      [toggleMask]="true" styleClass="ancho" inputStyleClass="ancho"
                      autocomplete="current-password" />
        </div>

        <button pButton type="submit" label="Ingresar" [loading]="cargando()"
                [disabled]="formulario.invalid" styleClass="ancho"></button>
      </form>
    </main>
  `,
  styles: [`
    .pantalla { min-height:100dvh; display:grid; place-items:center; padding:1.25rem;
                background:
                  radial-gradient(60rem 30rem at 0% 0%, var(--acento-lavado, #e6f2f3) 0%, transparent 60%),
                  radial-gradient(50rem 30rem at 100% 100%, #eef3f4 0%, transparent 60%),
                  var(--surface-ground); }
    .tarjeta { width:min(25rem, 100%); display:flex; flex-direction:column; gap:1.05rem;
               background:var(--surface-card); padding:2.25rem 2rem; border-radius:14px;
               border:1px solid var(--surface-border); box-shadow:0 12px 32px rgba(22,50,63,.08); }
    .marca { display:flex; justify-content:center; }
    .marca img { max-height:4.5rem; max-width:70%; object-fit:contain; }
    .marca-icono { width:3.5rem; height:3.5rem; border-radius:14px; display:grid; place-items:center;
                   background:var(--acento-lavado, #e6f2f3); color:var(--acento, #0e7c86); font-size:1.5rem; }
    .titulos { text-align:center; }
    h1 { margin:0 0 .3rem; font-size:1.25rem; font-weight:600; }
    .bajada { margin:0; font-size:.875rem; color:var(--text-color-secondary); line-height:1.5; }
    .campo { display:flex; flex-direction:column; gap:.375rem; }
    .campo label { font-size:.8125rem; font-weight:500; }
    .campo input { width:100%; }
    :host ::ng-deep .ancho, :host ::ng-deep .ancho-total { width:100%; display:block; }
  `],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly empresa = inject(EmpresaService);

  constructor() {
    this.empresa.cargar();
  }

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  readonly formulario = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  ingresar(): void {
    this.cargando.set(true);
    this.error.set(null);

    const { email, password } = this.formulario.getRawValue();

    this.auth.login(email, password).subscribe({
      next: res => this.router.navigate([
        res.usuario.debe_cambiar_clave ? '/cambiar-clave' : '/tablero',
      ]),
      error: err => {
        this.cargando.set(false);
        this.error.set(
          err.error?.errors?.email?.[0]
          ?? err.error?.message
          ?? 'No se pudo iniciar sesión. Intente nuevamente.',
        );
      },
    });
  }
}
