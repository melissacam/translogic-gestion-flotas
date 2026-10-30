import { Inbox, RefreshCw, WifiOff } from 'lucide';
import { ApiError } from '../api/http';
import { boton } from './button';
import { h, icono, reemplazar } from './dom';

// Skeleton de carga: bloques con la forma aproximada del contenido
export function skeleton(filas = 4): HTMLDivElement {
  return h(
    'div',
    { class: 'flex flex-col gap-3', 'aria-busy': 'true', 'aria-label': 'Cargando' },
    ...Array.from({ length: filas }, () => h('div', { class: 'esqueleto h-20' })),
  );
}

export function vacio(titulo: string, detalle: string, accion?: HTMLElement): HTMLDivElement {
  return h(
    'div',
    { class: 'tarjeta p-8 text-center flex flex-col items-center gap-2' },
    h('span', { class: 'bg-fondo rounded-full p-3 text-tinta-suave' }, icono(Inbox)),
    h('p', { class: 'font-semibold' }, titulo),
    h('p', { class: 'text-sm text-tinta-suave max-w-sm' }, detalle),
    accion ?? null,
  );
}

export function errorConexion(err: unknown, reintentar: () => void): HTMLDivElement {
  const api = err instanceof ApiError ? err : null;
  return h(
    'div',
    { class: 'tarjeta p-8 text-center flex flex-col items-center gap-3', role: 'alert' },
    h('span', { class: 'bg-rosa-polvo rounded-full p-3' }, icono(WifiOff)),
    h('p', { class: 'font-semibold' }, api?.sinConexion ? 'No pudimos conectar con el servidor' : 'No se pudo cargar la información'),
    h('p', { class: 'text-sm text-tinta-suave max-w-sm' }, api?.message ?? 'Ocurrió un error inesperado.'),
    boton('Reintentar', { variante: 'primario', icono: RefreshCw, onClick: reintentar }),
  );
}

// Patrón de vista asíncrona: skeleton → contenido | vacío | error con Reintentar
export async function cargarEn<T>(
  contenedor: HTMLElement,
  cargar: () => Promise<T>,
  pintar: (datos: T) => void,
  filasSkeleton = 4,
): Promise<void> {
  reemplazar(contenedor, skeleton(filasSkeleton));
  try {
    pintar(await cargar());
  } catch (err) {
    reemplazar(contenedor, errorConexion(err, () => void cargarEn(contenedor, cargar, pintar, filasSkeleton)));
  }
}
