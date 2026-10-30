import { CircleAlert, CircleCheck, Info } from 'lucide';
import { h, icono } from './dom';

type Tipo = 'exito' | 'error' | 'info';

const ESTILO: Record<Tipo, { fondo: string; icono: typeof CircleCheck }> = {
  exito: { fondo: 'bg-salvia', icono: CircleCheck },
  error: { fondo: 'bg-rosa-polvo', icono: CircleAlert },
  info: { fondo: 'bg-pervinca', icono: Info },
};

export function toast(mensaje: string, tipo: Tipo = 'exito', ms = 4500): void {
  const zona = document.getElementById('toasts');
  if (!zona) return;
  const e = ESTILO[tipo];
  const nodo = h(
    'div',
    {
      class: `${e.fondo} text-tinta rounded-app shadow-suave border border-borde px-4 py-3 flex items-start gap-3 pointer-events-auto text-sm`,
      role: tipo === 'error' ? 'alert' : 'status',
    },
    icono(e.icono, 'mt-0.5'),
    h('span', { class: 'flex-1' }, mensaje),
  );
  zona.appendChild(nodo);
  setTimeout(() => nodo.remove(), ms);
}
