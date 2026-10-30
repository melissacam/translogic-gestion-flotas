import { ChevronLeft, ChevronRight } from 'lucide';
import { boton } from './button';
import { h } from './dom';

export function paginacion(pagina: number, totalPaginas: number, total: number, ir: (p: number) => void): HTMLElement {
  const anterior = boton('', { icono: ChevronLeft, titulo: 'Página anterior', onClick: () => ir(pagina - 1) });
  const siguiente = boton('', { icono: ChevronRight, titulo: 'Página siguiente', onClick: () => ir(pagina + 1) });
  anterior.disabled = pagina <= 1;
  siguiente.disabled = pagina >= totalPaginas;
  return h(
    'nav',
    { class: 'flex items-center justify-between gap-2 mt-4', 'aria-label': 'Paginación' },
    h('p', { class: 'text-sm text-tinta-suave' }, `${total} registro${total === 1 ? '' : 's'} · página ${Math.max(pagina, 1)} de ${Math.max(totalPaginas, 1)}`),
    h('div', { class: 'flex gap-2' }, anterior, siguiente),
  );
}
