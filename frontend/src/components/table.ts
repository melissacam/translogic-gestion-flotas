import { h, type Hijo } from './dom';

export interface Columna<T> {
  titulo: string;
  celda: (fila: T) => Hijo;
  alineacion?: 'izquierda' | 'derecha';
  // En móvil la columna principal va como título de la tarjeta
  principal?: boolean;
  ocultarEnMovil?: boolean;
}

// Tabla desde md; en móvil cada fila es una tarjeta apilada
export function tablaResponsive<T>(
  filas: T[],
  columnas: Columna<T>[],
  opciones: { alSeleccionar?: (fila: T) => void; acciones?: (fila: T) => Hijo } = {},
): HTMLDivElement {
  const interactiva = Boolean(opciones.alSeleccionar);
  const tabla = h(
    'table',
    { class: 'hidden md:table w-full text-sm' },
    h(
      'thead',
      null,
      h(
        'tr',
        { class: 'text-left text-tinta-suave border-b border-borde' },
        ...columnas.map((c) => h('th', { class: `px-4 py-3 font-medium ${c.alineacion === 'derecha' ? 'text-right' : ''}`, scope: 'col' }, c.titulo)),
        opciones.acciones ? h('th', { class: 'px-4 py-3' }, h('span', { class: 'sr-only' }, 'Acciones')) : null,
      ),
    ),
    h(
      'tbody',
      null,
      ...filas.map((f) =>
        h(
          'tr',
          {
            class: `border-b border-borde last:border-0 ${interactiva ? 'hover:bg-fondo cursor-pointer' : ''}`,
            onClick: interactiva ? () => opciones.alSeleccionar!(f) : undefined,
          },
          ...columnas.map((c) => h('td', { class: `px-4 py-3 ${c.alineacion === 'derecha' ? 'text-right tabular-nums' : ''}` }, c.celda(f))),
          opciones.acciones ? h('td', { class: 'px-4 py-2 text-right whitespace-nowrap', onClick: (e: Event) => e.stopPropagation() }, opciones.acciones(f)) : null,
        ),
      ),
    ),
  );

  const principal = columnas.find((c) => c.principal) ?? columnas[0];
  const tarjetas = h(
    'ul',
    { class: 'md:hidden flex flex-col gap-3' },
    ...filas.map((f) =>
      h(
        'li',
        { class: 'tarjeta p-4' },
        h(
          interactiva ? 'button' : 'div',
          {
            class: 'w-full text-left flex flex-col gap-2',
            type: interactiva ? 'button' : undefined,
            onClick: interactiva ? () => opciones.alSeleccionar!(f) : undefined,
          },
          h('div', { class: 'font-semibold' }, principal.celda(f)),
          h(
            'dl',
            { class: 'grid grid-cols-2 gap-x-3 gap-y-1 text-sm' },
            ...columnas
              .filter((c) => c !== principal && !c.ocultarEnMovil)
              .map((c) => [h('dt', { class: 'text-tinta-suave' }, c.titulo), h('dd', { class: 'text-right' }, c.celda(f))]),
          ),
        ),
        opciones.acciones ? h('div', { class: 'flex flex-wrap gap-2 justify-end mt-3' }, opciones.acciones(f)) : null,
      ),
    ),
  );
  return h('div', { class: 'md:bg-superficie md:border md:border-borde md:rounded-app md:shadow-suave md:overflow-x-auto' }, tabla, tarjetas);
}
