import { h } from './dom';
import { envolver, type Campo } from './input';

export interface Opcion {
  valor: string;
  texto: string;
}

export function opciones(select: HTMLSelectElement, lista: Opcion[], vacia?: string, seleccion?: string): void {
  select.replaceChildren(
    ...(vacia !== undefined ? [h('option', { value: '' }, vacia)] : []),
    ...lista.map((o) => h('option', { value: o.valor, selected: o.valor === seleccion }, o.texto)),
  );
  if (seleccion !== undefined) select.value = seleccion;
}

export function campoSelect(etiqueta: string, nombre: string, lista: Opcion[], vacia?: string, seleccion?: string): Campo<HTMLSelectElement> {
  const control = h('select', { class: 'campo', name: nombre });
  opciones(control, lista, vacia, seleccion);
  return envolver(etiqueta, control);
}
