import { X } from 'lucide';
import { boton } from './button';
import { h, type Hijo } from './dom';

export interface Modal {
  cuerpo: HTMLDivElement;
  pie: HTMLDivElement;
  cerrar: () => void;
}

// Hoja inferior en móvil, diálogo centrado (o panel lateral) desde md
export function abrirModal(titulo: string, opciones: { lateral?: boolean; alCerrar?: () => void } = {}): Modal {
  const anterior = document.activeElement as HTMLElement | null;
  const cuerpo = h('div', { class: 'px-4 md:px-6 py-4 overflow-y-auto flex-1' });
  const pie = h('div', { class: 'px-4 md:px-6 py-3 border-t border-borde flex flex-wrap justify-end gap-2 empty:hidden' });
  const idTitulo = `modal-${Date.now()}`;
  const panel = h(
    'div',
    {
      class: opciones.lateral
        ? 'bg-superficie w-full md:w-[480px] md:h-full max-h-[90dvh] md:max-h-none rounded-t-app md:rounded-none flex flex-col self-end md:self-stretch md:ml-auto'
        : 'bg-superficie w-full md:max-w-xl max-h-[90dvh] rounded-t-app md:rounded-app flex flex-col self-end md:self-center',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': idTitulo,
    },
    h(
      'div',
      { class: 'flex items-center justify-between gap-2 px-4 md:px-6 py-3 border-b border-borde' },
      h('h2', { id: idTitulo, class: 'text-lg font-semibold' }, titulo),
      boton('', { icono: X, titulo: 'Cerrar', clase: 'border-transparent px-2', onClick: () => cerrar() }),
    ),
    cuerpo,
    pie,
  );
  const fondo = h(
    'div',
    {
      class: 'fixed inset-0 z-40 bg-tinta/40 flex justify-center md:p-6',
      onClick: (e: MouseEvent) => {
        if (e.target === fondo) cerrar();
      },
    },
    panel,
  );
  const alTeclear = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cerrar();
  };
  function cerrar() {
    document.removeEventListener('keydown', alTeclear);
    fondo.remove();
    document.body.style.overflow = '';
    anterior?.focus();
    opciones.alCerrar?.();
  }
  document.addEventListener('keydown', alTeclear);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(fondo);
  queueMicrotask(() => (panel.querySelector('input, select, button:not([title="Cerrar"])') as HTMLElement | null)?.focus());
  return { cuerpo, pie, cerrar };
}

// Modal de confirmación para acciones de estado (Iniciar, Completar, Cancelar)
export function confirmar(
  titulo: string,
  mensaje: Hijo,
  textoAccion: string,
  accion: (modal: Modal, boton: HTMLButtonElement) => Promise<void>,
  variante: 'primario' | 'peligro' = 'primario',
): Modal {
  const modal = abrirModal(titulo);
  modal.cuerpo.append(h('div', { class: 'text-base' }, mensaje));
  const btn = boton(textoAccion, { variante });
  btn.addEventListener('click', () => void accion(modal, btn));
  modal.pie.append(boton('Volver', { onClick: () => modal.cerrar() }), btn);
  return modal;
}
