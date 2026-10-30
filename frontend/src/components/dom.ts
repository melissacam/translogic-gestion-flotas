import { createElement, type IconNode } from 'lucide';

export type Hijo = Node | string | number | null | undefined | false | Hijo[];
type Atributos = Record<string, unknown>;

// Constructor de elementos: el texto se inserta con textContent (sin riesgo de XSS)
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Atributos | null,
  ...hijos: Hijo[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [clave, valor] of Object.entries(attrs ?? {})) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (clave.startsWith('on') && typeof valor === 'function') {
      el.addEventListener(clave.slice(2).toLowerCase(), valor as EventListener);
    } else if (clave === 'class') {
      el.className = String(valor);
    } else if (clave === 'value' || clave === 'checked' || clave === 'disabled' || clave === 'selected') {
      (el as unknown as Record<string, unknown>)[clave] = valor;
    } else {
      el.setAttribute(clave, valor === true ? '' : String(valor));
    }
  }
  agregar(el, hijos);
  return el;
}

export function agregar(padre: Node, hijos: Hijo[]): void {
  for (const hijo of hijos) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    if (Array.isArray(hijo)) agregar(padre, hijo);
    else padre.appendChild(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
}

export function reemplazar(padre: Element, ...hijos: Hijo[]): void {
  padre.replaceChildren();
  agregar(padre, hijos);
}

// Íconos de línea finos y del mismo tamaño en toda la app
export function icono(nodo: IconNode, clase = ''): SVGElement {
  const svg = createElement(nodo, {
    width: 20,
    height: 20,
    'stroke-width': 1.75,
    'aria-hidden': 'true',
    class: `shrink-0 ${clase}`,
  });
  return svg;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
