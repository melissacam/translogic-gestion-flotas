import { LogIn } from 'lucide';
import { authApi } from '../api/auth.api';
import { ApiError } from '../api/http';
import { boton, conCarga } from '../components/button';
import { h, reemplazar } from '../components/dom';
import { campoTexto } from '../components/input';
import { toast } from '../components/toast';
import { navegar, type Pagina } from '../core/router';
import { session } from '../core/session';
import { correo, enlazarValidacion, minimoLargo, requerido } from '../core/validators';

export const paginaLogin: Pagina = (raiz) => {
  document.title = 'Iniciar sesión · TRANSLOGIC';
  const email = campoTexto('Correo electrónico', 'email', { tipo: 'email', inputmode: 'email', autocompletar: 'username', placeholder: 'nombre@translogic.ec' });
  const clave = campoTexto('Contraseña', 'password', { tipo: 'password', autocompletar: 'current-password' });
  const alerta = h('p', { class: 'hidden bg-rosa-polvo/60 text-tinta rounded-app px-3 py-2 text-sm', role: 'alert' });
  const enviar = boton('Ingresar', { variante: 'primario', icono: LogIn, tipo: 'submit', clase: 'w-full' });

  const valido = enlazarValidacion([
    { control: email.control, error: email.error, reglas: [requerido('Ingresa tu correo'), correo] },
    { control: clave.control, error: clave.error, reglas: [requerido('Ingresa tu contraseña'), minimoLargo(6, 'Mínimo 6 caracteres')] },
  ]);

  const formulario = h(
    'form',
    {
      class: 'flex flex-col gap-2',
      novalidate: true,
      onSubmit: async (e: SubmitEvent) => {
        e.preventDefault();
        alerta.classList.add('hidden');
        if (!valido()) return;
        try {
          const r = await conCarga(enviar, () => authApi.login(email.control.value.trim(), clave.control.value), 'Ingresando…');
          session.guardar(r.accessToken, r.usuario);
          toast(`Bienvenido, ${r.usuario.nombre}`);
          navegar(r.usuario.rol === 'ADMINISTRADOR' ? 'dashboard' : 'servicios');
        } catch (err) {
          const e401 = err instanceof ApiError && err.status === 401;
          const e429 = err instanceof ApiError && err.status === 429;
          alerta.textContent = e401
            ? 'Correo o contraseña incorrectos.'
            : e429
              ? 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.'
              : err instanceof Error
                ? err.message
                : 'No se pudo iniciar sesión';
          alerta.classList.remove('hidden');
        }
      },
    },
    alerta,
    email.contenedor,
    clave.contenedor,
    enviar,
  );

  reemplazar(
    raiz,
    h(
      'main',
      { class: 'min-h-dvh flex items-center justify-center px-4 py-10' },
      h(
        'div',
        { class: 'w-full max-w-sm' },
        h(
          'div',
          { class: 'mb-6 text-center' },
          h('p', { class: 'text-2xl font-bold text-salvia-fuerte' }, 'TRANSLOGIC S.A.'),
          h('p', { class: 'text-sm text-tinta-suave' }, 'Gestión de flotas, servicios y facturación'),
        ),
        h('section', { class: 'tarjeta p-6' }, h('h1', { class: 'text-lg font-semibold mb-4' }, 'Iniciar sesión'), formulario),
      ),
    ),
  );
};
