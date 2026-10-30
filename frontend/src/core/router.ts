import { BarChart3, Ellipsis, FileText, LayoutDashboard, LogOut, Route, Truck, Users } from 'lucide';
import type { IconNode } from 'lucide';
import { alExpirarSesion } from '../api/http';
import { h, icono, reemplazar } from '../components/dom';
import { abrirModal } from '../components/modal';
import { toast } from '../components/toast';
import type { Rol } from '../types';
import { session } from './session';

export type Desmontar = () => void;
export type Pagina = (contenedor: HTMLElement) => Desmontar | void;

interface Ruta {
  titulo: string;
  icono: IconNode;
  roles: Rol[];
  cargar: () => Promise<Pagina>;
}

const TODOS: Rol[] = ['ADMINISTRADOR', 'OPERADOR'];
const ADMIN: Rol[] = ['ADMINISTRADOR'];

// Las páginas se cargan bajo demanda (code splitting por ruta)
const RUTAS: Record<string, Ruta> = {
  dashboard: { titulo: 'Panel', icono: LayoutDashboard, roles: ADMIN, cargar: () => import('../pages/dashboard').then((m) => m.paginaDashboard) },
  servicios: { titulo: 'Servicios', icono: Route, roles: TODOS, cargar: () => import('../pages/servicios').then((m) => m.paginaServicios) },
  vehiculos: { titulo: 'Vehículos', icono: Truck, roles: TODOS, cargar: () => import('../pages/vehiculos').then((m) => m.paginaVehiculos) },
  clientes: { titulo: 'Clientes', icono: Users, roles: TODOS, cargar: () => import('../pages/clientes').then((m) => m.paginaClientes) },
  facturas: { titulo: 'Facturación', icono: FileText, roles: ADMIN, cargar: () => import('../pages/facturas').then((m) => m.paginaFacturas) },
  reportes: { titulo: 'Reportes', icono: BarChart3, roles: ADMIN, cargar: () => import('../pages/reportes').then((m) => m.paginaReportes) },
};

let desmontar: Desmontar | void;

function inicioPorRol(): string {
  return session.esAdmin() ? 'dashboard' : 'servicios';
}

export function navegar(ruta: string): void {
  location.hash = `#/${ruta}`;
}

function rutaActual(): string {
  return location.hash.replace(/^#\/?/, '').split('?')[0];
}

// Guard de navegación: sin sesión → login; rol sin permiso → su inicio con aviso
async function resolver(raiz: HTMLElement): Promise<void> {
  desmontar?.();
  desmontar = undefined;
  const ruta = rutaActual();

  if (!session.activa()) {
    if (ruta !== 'login') return navegar('login');
    const { paginaLogin } = await import('../pages/login');
    desmontar = paginaLogin(raiz);
    return;
  }
  if (ruta === 'login' || !RUTAS[ruta]) return navegar(inicioPorRol());

  const definicion = RUTAS[ruta];
  if (!session.tieneRol(...definicion.roles)) {
    toast('Esa sección es solo para administradores.', 'info');
    return navegar(inicioPorRol());
  }

  const contenido = h('main', { id: 'contenido', class: 'flex-1 px-4 md:px-8 py-6 pb-28 md:pb-8 max-w-6xl w-full mx-auto', tabindex: '-1' });
  reemplazar(raiz, marco(ruta, contenido));
  document.title = `${definicion.titulo} · TRANSLOGIC`;
  const pagina = await definicion.cargar();
  desmontar = pagina(contenido);
}

// Barra lateral desde md, navegación inferior fija en móvil
function marco(activa: string, contenido: HTMLElement): HTMLElement {
  const usuario = session.usuario()!;
  const visibles = Object.entries(RUTAS).filter(([, r]) => session.tieneRol(...r.roles));
  const enlace = (clave: string, r: Ruta, movil: boolean) =>
    h(
      'a',
      {
        href: `#/${clave}`,
        'aria-current': clave === activa ? 'page' : undefined,
        class: movil
          ? `flex flex-col items-center justify-center gap-0.5 min-h-14 flex-1 text-xs ${clave === activa ? 'text-salvia-fuerte font-semibold' : 'text-tinta-suave'}`
          : `flex items-center gap-3 px-3 min-h-11 rounded-app text-sm ${clave === activa ? 'bg-salvia/40 text-tinta font-semibold' : 'text-tinta-suave hover:bg-fondo'}`,
      },
      icono(r.icono),
      h('span', null, r.titulo),
    );
  const salir = () => {
    session.cerrar();
    toast('Sesión cerrada', 'info');
    navegar('login');
  };

  return h(
    'div',
    { class: 'min-h-dvh flex flex-col md:flex-row' },
    h('a', { href: '#contenido', class: 'sr-only focus:not-sr-only focus:absolute focus:p-2 bg-superficie' }, 'Saltar al contenido'),
    h(
      'aside',
      { class: 'hidden md:flex md:flex-col w-60 shrink-0 bg-superficie border-r border-borde p-4 gap-1 sticky top-0 h-dvh' },
      h('div', { class: 'px-3 py-2 mb-4' }, h('p', { class: 'font-bold text-salvia-fuerte' }, 'TRANSLOGIC S.A.'), h('p', { class: 'text-sm text-tinta-suave' }, 'Gestión de flotas')),
      h('nav', { class: 'flex flex-col gap-1', 'aria-label': 'Principal' }, ...visibles.map(([c, r]) => enlace(c, r, false))),
      h(
        'div',
        { class: 'mt-auto border-t border-borde pt-3 px-3 flex flex-col gap-2' },
        h('p', { class: 'text-sm font-medium' }, usuario.nombre),
        h('p', { class: 'text-sm text-tinta-suave' }, usuario.rol === 'ADMINISTRADOR' ? 'Administrador' : 'Operador'),
        h('button', { type: 'button', class: 'btn btn-secundario', onClick: salir }, icono(LogOut), 'Cerrar sesión'),
      ),
    ),
    h(
      'header',
      { class: 'md:hidden flex items-center justify-between px-4 h-14 bg-superficie border-b border-borde sticky top-0 z-30' },
      h('p', { class: 'font-bold text-salvia-fuerte' }, 'TRANSLOGIC'),
      h(
        'div',
        { class: 'flex items-center gap-2' },
        h('span', { class: 'text-sm text-tinta-suave' }, usuario.nombre.split(' ')[0]),
        h('button', { type: 'button', class: 'btn btn-secundario px-3', onClick: salir, title: 'Cerrar sesión', 'aria-label': 'Cerrar sesión' }, icono(LogOut)),
      ),
    ),
    contenido,
    h(
      'nav',
      { class: 'md:hidden fixed bottom-0 inset-x-0 z-30 bg-superficie border-t border-borde flex pb-[env(safe-area-inset-bottom)]', 'aria-label': 'Principal' },
      ...(visibles.length <= 5 ? visibles : visibles.slice(0, 4)).map(([c, r]) => enlace(c, r, true)),
      visibles.length > 5 ? botonMas(visibles.slice(4), activa) : null,
    ),
  );
}

// Móvil: máximo 5 íconos; el resto de secciones va en una hoja inferior «Más»
function botonMas(resto: [string, Ruta][], activa: string): HTMLButtonElement {
  const activo = resto.some(([c]) => c === activa);
  return h(
    'button',
    {
      type: 'button',
      class: `flex flex-col items-center justify-center gap-0.5 min-h-14 flex-1 text-xs ${activo ? 'text-salvia-fuerte font-semibold' : 'text-tinta-suave'}`,
      onClick: () => {
        const modal = abrirModal('Más secciones');
        modal.cuerpo.append(
          ...resto.map(([c, r]) =>
            h(
              'a',
              { href: `#/${c}`, class: 'flex items-center gap-3 min-h-12 px-2 rounded-app hover:bg-fondo', onClick: () => modal.cerrar() },
              icono(r.icono),
              r.titulo,
            ),
          ),
        );
      },
    },
    icono(Ellipsis),
    h('span', null, 'Más'),
  );
}

export function iniciarRouter(raiz: HTMLElement): void {
  alExpirarSesion(() => {
    toast('Tu sesión expiró. Inicia sesión nuevamente.', 'info');
    navegar('login');
  });
  window.addEventListener('hashchange', () => void resolver(raiz));
  void resolver(raiz);
}
