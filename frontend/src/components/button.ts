import type { IconNode } from 'lucide';
import { h, icono } from './dom';

type Variante = 'primario' | 'secundario' | 'peligro';

export function boton(
  texto: string,
  opciones: { variante?: Variante; icono?: IconNode; onClick?: (e: MouseEvent) => void; tipo?: 'button' | 'submit'; clase?: string; titulo?: string } = {},
): HTMLButtonElement {
  return h(
    'button',
    {
      type: opciones.tipo ?? 'button',
      class: `btn btn-${opciones.variante ?? 'secundario'} ${opciones.clase ?? ''}`,
      onClick: opciones.onClick,
      title: opciones.titulo,
    },
    opciones.icono ? icono(opciones.icono) : null,
    texto ? h('span', null, texto) : null,
  );
}

// Deshabilita el botón mientras dura la petición: evita el doble envío
export async function conCarga<T>(btn: HTMLButtonElement, tarea: () => Promise<T>, textoCarga = 'Procesando…'): Promise<T> {
  const original = Array.from(btn.childNodes);
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.replaceChildren(h('span', { class: 'size-4 rounded-full border-2 border-current border-r-transparent animate-spin' }), h('span', null, textoCarga));
  try {
    return await tarea();
  } finally {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    btn.replaceChildren(...original);
  }
}
