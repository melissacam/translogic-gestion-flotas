import { DateTime } from 'luxon';

export const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const FORMATO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

// fecha + hora locales (ZONA_HORARIA) → instante UTC con luxon
export function combinarFechaHora(
  fecha: string,
  hora: string,
  zona: string,
): Date {
  const dt = DateTime.fromISO(`${fecha}T${hora}`, { zone: zona });
  if (!dt.isValid) throw new Error(`Fecha u hora inválida: ${fecha} ${hora}`);
  return dt.toUTC().toJSDate();
}

export function inicioDelDia(fecha: string, zona: string): Date {
  return DateTime.fromISO(fecha, { zone: zona })
    .startOf('day')
    .toUTC()
    .toJSDate();
}

export function finDelDia(fecha: string, zona: string): Date {
  return DateTime.fromISO(fecha, { zone: zona })
    .endOf('day')
    .toUTC()
    .toJSDate();
}

// Domingo según la zona del negocio (America/Guayaquil), no según UTC
export function esDomingo(instante: Date, zona: string): boolean {
  return DateTime.fromJSDate(instante, { zone: zona }).weekday === 7;
}

export function rangoDelMes(
  instante: Date,
  zona: string,
): { desde: Date; hasta: Date } {
  const local = DateTime.fromJSDate(instante, { zone: zona });
  return {
    desde: local.startOf('month').toUTC().toJSDate(),
    hasta: local.endOf('month').toUTC().toJSDate(),
  };
}

export function rangoDeMesTexto(
  mes: string,
  zona: string,
): { desde: Date; hasta: Date } {
  const local = DateTime.fromISO(`${mes}-01`, { zone: zona });
  return {
    desde: local.startOf('month').toUTC().toJSDate(),
    hasta: local.endOf('month').toUTC().toJSDate(),
  };
}

export function periodoDe(instante: Date, zona: string): string {
  return DateTime.fromJSDate(instante, { zone: zona }).toFormat('yyyy-MM');
}

export function fechaLocal(instante: Date, zona: string): string {
  return DateTime.fromJSDate(instante, { zone: zona }).toISODate() as string;
}

export function horaLocal(instante: Date, zona: string): string {
  return DateTime.fromJSDate(instante, { zone: zona }).toFormat('HH:mm');
}

export function hoyLocal(zona: string): string {
  return DateTime.now().setZone(zona).toISODate() as string;
}
