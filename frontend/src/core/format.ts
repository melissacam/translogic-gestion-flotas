import type { EstadoServicio } from '../types';

const ZONA = 'America/Guayaquil';

const moneda = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const numero = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 });

// Solo formatea: los importes ya vienen calculados y redondeados por el backend
export function usd(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  return moneda.format(Number(valor));
}

export function num(valor: string | number | null | undefined, sufijo = ''): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  return `${numero.format(Number(valor))}${sufijo}`;
}

export function pct(valor: string | number | null | undefined): string {
  return num(valor, ' %');
}

export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-EC', { timeZone: ZONA, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-EC', { timeZone: ZONA, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

// AAAA-MM-DD en la zona del negocio (para inputs type=date)
export function isoLocal(fechaBase = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(fechaBase);
}

export function mesActual(): string {
  return isoLocal().slice(0, 7);
}

export function nombreMes(mes: number): string {
  return new Intl.DateTimeFormat('es-EC', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, mes - 1, 15)));
}

export function ultimoDiaDelMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${mes}-${String(dia).padStart(2, '0')}`;
}

export const TEXTO_ESTADO: Record<EstadoServicio, string> = {
  PROGRAMADO: 'Programado',
  EN_EJECUCION: 'En ejecución',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
};
