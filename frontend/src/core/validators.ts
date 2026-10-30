// Mismas reglas que los DTO del backend (solo para respuesta inmediata en la UI)
export type Regla = (valor: string) => string | null;

export const requerido =
  (mensaje = 'Campo obligatorio'): Regla =>
  (v) =>
    v.trim() ? null : mensaje;

export const correo: Regla = (v) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) ? null : 'El correo no es válido');

export const minimoLargo =
  (n: number, mensaje: string): Regla =>
  (v) =>
    v.length >= n ? null : mensaje;

export const patron =
  (re: RegExp, mensaje: string): Regla =>
  (v) =>
    re.test(v.trim()) ? null : mensaje;

export const numeroEntre =
  (min: number, max: number, mensaje: string, exclusivoMin = false): Regla =>
  (v) => {
    if (v.trim() === '') return 'Campo obligatorio';
    const n = Number(v);
    if (Number.isNaN(n)) return 'Debe ser un número';
    if (exclusivoMin ? n <= min : n < min) return mensaje;
    return n > max ? mensaje : null;
  };

export const positivo = (mensaje = 'Debe ser mayor a 0'): Regla => numeroEntre(0, Number.MAX_SAFE_INTEGER, mensaje, true);
export const noNegativo = (mensaje = 'No puede ser negativo'): Regla => numeroEntre(0, Number.MAX_SAFE_INTEGER, mensaje);
export const entero: Regla = (v) => (Number.isInteger(Number(v)) ? null : 'Debe ser un número entero');

export const PLACA = /^[A-Z]{3}-?\d{3,4}$/;
export const IDENTIFICACION = /^(\d{10}|\d{13})$/;
export const TELEFONO = /^\d{10}$/;
export const CODIGO_SERVICIO = /^[A-Z0-9-]{3,20}$/;
export const ANIO_MAXIMO = new Date().getFullYear() + 1;

export function normalizarPlaca(v: string): string {
  return v.toUpperCase().replace(/\s+/g, '');
}

export function validar(valor: string, reglas: Regla[]): string | null {
  for (const r of reglas) {
    const error = r(valor);
    if (error) return error;
  }
  return null;
}

// Valida en vivo (input/blur) y devuelve una función para validar todo al enviar
export function enlazarValidacion(
  campos: { control: HTMLInputElement | HTMLSelectElement; error: (m: string | null) => void; reglas: Regla[]; activo?: () => boolean }[],
): () => boolean {
  for (const c of campos) {
    const revisar = () => c.error(c.activo && !c.activo() ? null : validar(c.control.value, c.reglas));
    c.control.addEventListener('blur', revisar);
    c.control.addEventListener('input', () => {
      if (c.control.getAttribute('aria-invalid') === 'true') revisar();
    });
  }
  return () => {
    let ok = true;
    for (const c of campos) {
      if (c.activo && !c.activo()) {
        c.error(null);
        continue;
      }
      const error = validar(c.control.value, c.reglas);
      c.error(error);
      if (error) ok = false;
    }
    return ok;
  };
}
