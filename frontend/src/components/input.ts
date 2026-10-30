import { h } from './dom';

export interface Campo<E extends HTMLElement = HTMLInputElement> {
  contenedor: HTMLDivElement;
  control: E;
  error: (mensaje: string | null) => void;
}

let contador = 0;

function envolver<E extends HTMLElement>(etiqueta: string, control: E, ayuda?: string): Campo<E> {
  const id = `campo-${++contador}`;
  control.id = id;
  const error = h('p', { class: 'error-campo', id: `${id}-error`, role: 'alert' });
  control.setAttribute('aria-describedby', `${id}-error`);
  const contenedor = h(
    'div',
    null,
    h('label', { class: 'etiqueta', for: id }, etiqueta),
    control,
    ayuda ? h('p', { class: 'text-sm text-tinta-suave mt-1' }, ayuda) : null,
    error,
  );
  return {
    contenedor,
    control,
    error: (mensaje) => {
      error.textContent = mensaje ?? '';
      control.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
    },
  };
}

export interface OpcionesInput {
  tipo?: string;
  valor?: string | number | null;
  placeholder?: string;
  inputmode?: 'numeric' | 'decimal' | 'email' | 'tel' | 'text';
  requerido?: boolean;
  ayuda?: string;
  min?: string | number;
  max?: string | number;
  paso?: string;
  autocompletar?: string;
  soloLectura?: boolean;
}

export function campoTexto(etiqueta: string, nombre: string, o: OpcionesInput = {}): Campo {
  const control = h('input', {
    class: 'campo',
    name: nombre,
    type: o.tipo ?? 'text',
    value: o.valor ?? '',
    placeholder: o.placeholder,
    inputmode: o.inputmode,
    required: o.requerido,
    min: o.min,
    max: o.max,
    step: o.paso,
    autocomplete: o.autocompletar ?? 'off',
    readonly: o.soloLectura,
  });
  return envolver(etiqueta, control, o.ayuda);
}

export function campoNumero(etiqueta: string, nombre: string, o: OpcionesInput = {}): Campo {
  return campoTexto(etiqueta, nombre, { inputmode: 'decimal', paso: 'any', ...o, tipo: 'number' });
}

export function casilla(etiqueta: string, nombre: string, marcada = false): { contenedor: HTMLLabelElement; control: HTMLInputElement } {
  const control = h('input', { type: 'checkbox', name: nombre, checked: marcada, class: 'size-5 accent-salvia-fuerte' });
  return {
    control,
    contenedor: h('label', { class: 'flex items-center gap-3 min-h-11 cursor-pointer text-sm' }, control, etiqueta),
  };
}

export { envolver };
