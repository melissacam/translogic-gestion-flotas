import type { IconNode } from 'lucide';
import { h, icono, type Hijo } from './dom';

export function tarjeta(titulo: string | null, ...contenido: Hijo[]): HTMLElement {
  return h(
    'section',
    { class: 'tarjeta p-4 md:p-6' },
    titulo ? h('h2', { class: 'text-lg font-semibold mb-4' }, titulo) : null,
    ...contenido,
  );
}

// Tarjeta KPI: mismo borde y fondo para todas, el acento va solo en el ícono
export function tarjetaKpi(titulo: string, valor: string, nodo: IconNode, detalle?: string): HTMLElement {
  return h(
    'div',
    { class: 'tarjeta p-4 flex flex-col gap-2' },
    h(
      'div',
      { class: 'flex items-center justify-between text-tinta-suave text-sm' },
      h('span', null, titulo),
      h('span', { class: 'bg-salvia/50 text-tinta rounded-full p-1.5' }, icono(nodo, 'size-4')),
    ),
    h('p', { class: 'text-xl md:text-2xl font-semibold tabular-nums' }, valor),
    detalle ? h('p', { class: 'text-sm text-tinta-suave' }, detalle) : null,
  );
}

export function filaDato(etiqueta: string, valor: Hijo, destacado = false): HTMLElement {
  return h(
    'div',
    { class: `flex justify-between gap-4 py-1.5 ${destacado ? 'font-semibold text-base border-t border-borde mt-1 pt-2' : 'text-sm'}` },
    h('span', { class: destacado ? '' : 'text-tinta-suave' }, etiqueta),
    h('span', { class: 'text-right tabular-nums whitespace-nowrap' }, valor),
  );
}

export function encabezado(titulo: string, subtitulo: string, ...acciones: Hijo[]): HTMLElement {
  return h(
    'header',
    { class: 'flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6' },
    h('div', null, h('h1', { class: 'text-xl md:text-2xl font-semibold' }, titulo), h('p', { class: 'text-sm text-tinta-suave' }, subtitulo)),
    acciones.length ? h('div', { class: 'flex flex-wrap gap-2' }, ...acciones) : null,
  );
}
